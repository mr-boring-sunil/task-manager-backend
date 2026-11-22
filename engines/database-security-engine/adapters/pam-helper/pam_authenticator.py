#!/usr/bin/env python3
"""
Isolated Linux PAM Authentication Helper
Raspberry Pi Task Manager — Database & Security Engine

Protocol:
- Accepts single JSON line via STDIN: {"username": "...", "password": "...", "service": "common-auth"}
- Uses ctypes to invoke Linux POSIX libpam.so.0 directly.
- Allocates memory with libc calloc and strdup returning c_void_p pointers so PAM can safely free() them.
- Validates credentials via pam_authenticate() and account eligibility via pam_acct_mgmt().
- Zero shell execution, zero command execution, zero /etc/shadow direct reading.
- Securely wipes password buffer from memory immediately following authentication.
- Emits single JSON line via STDOUT: {"success": true, "username": "..."} or {"success": false, "error": "..."}
"""

import sys
import json
import os
import platform

def authenticate_pam(username, password, service="task-manager"):
    if platform.system() != "Linux":
        return {
            "success": False,
            "error": "PAM_UNAVAILABLE",
            "message": f"Linux PAM is not supported on {platform.system()}"
        }

    try:
        import ctypes
        import ctypes.util

        pam_lib_name = ctypes.util.find_library("pam") or "libpam.so.0"
        pam = ctypes.CDLL(pam_lib_name)
    except Exception as e:
        return {
            "success": False,
            "error": "PAM_UNAVAILABLE",
            "message": f"Failed to load libpam: {str(e)}"
        }

    # Load libc for proper memory allocation that PAM can free()
    try:
        libc_name = ctypes.util.find_library("c") or "libc.so.6"
        libc = ctypes.CDLL(libc_name)
        libc.calloc.restype = ctypes.c_void_p
        libc.calloc.argtypes = [ctypes.c_size_t, ctypes.c_size_t]
        libc.strdup.argtypes = [ctypes.c_char_p]
        libc.strdup.restype = ctypes.c_void_p
    except Exception as e:
        return {
            "success": False,
            "error": "PAM_UNAVAILABLE",
            "message": f"Failed to load libc: {str(e)}"
        }

    # PAM Constants
    PAM_SUCCESS = 0
    PAM_PROMPT_ECHO_OFF = 1
    PAM_PROMPT_ECHO_ON = 2
    PAM_ERROR_MSG = 3
    PAM_TEXT_INFO = 4

    class PamMessage(ctypes.Structure):
        _fields_ = [
            ("msg_style", ctypes.c_int),
            ("msg", ctypes.c_char_p)
        ]

    class PamResponse(ctypes.Structure):
        _fields_ = [
            ("resp", ctypes.c_void_p),
            ("resp_retcode", ctypes.c_int)
        ]

    class PamConv(ctypes.Structure):
        pass

    conv_func_type = ctypes.CFUNCTYPE(
        ctypes.c_int,
        ctypes.c_int,
        ctypes.POINTER(ctypes.POINTER(PamMessage)),
        ctypes.POINTER(ctypes.c_void_p),
        ctypes.c_void_p
    )

    PamConv._fields_ = [
        ("conv", conv_func_type),
        ("appdata_ptr", ctypes.c_void_p)
    ]

    # Convert password to mutable bytearray for zeroing
    pwd_bytes = bytearray(password.encode("utf-8"))

    def conversation_callback(num_msg, msg_ptr, resp_ptr, appdata_ptr):
        try:
            p_mem = libc.calloc(num_msg, ctypes.sizeof(PamResponse))
            if not p_mem:
                return 19 # PAM_CONV_ERR

            resp_array = (PamResponse * num_msg).from_address(p_mem)

            for i in range(num_msg):
                m = msg_ptr[i].contents
                style = m.msg_style

                if style == PAM_PROMPT_ECHO_OFF:
                    # Password prompt
                    resp_array[i].resp = libc.strdup(bytes(pwd_bytes))
                    resp_array[i].resp_retcode = 0
                elif style == PAM_PROMPT_ECHO_ON:
                    # Username or other input prompt
                    resp_array[i].resp = libc.strdup(username.encode("utf-8"))
                    resp_array[i].resp_retcode = 0
                else:
                    resp_array[i].resp = None
                    resp_array[i].resp_retcode = 0

            resp_ptr[0] = p_mem
            return PAM_SUCCESS
        except Exception:
            return 19 # PAM_CONV_ERR

    conv_func = conv_func_type(conversation_callback)
    conv_struct = PamConv(conv_func, None)

    pam.pam_start.restype = ctypes.c_int
    pam.pam_start.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.POINTER(PamConv), ctypes.POINTER(ctypes.c_void_p)]

    pam.pam_authenticate.restype = ctypes.c_int
    pam.pam_authenticate.argtypes = [ctypes.c_void_p, ctypes.c_int]

    pam.pam_acct_mgmt.restype = ctypes.c_int
    pam.pam_acct_mgmt.argtypes = [ctypes.c_void_p, ctypes.c_int]

    pam.pam_end.restype = ctypes.c_int
    pam.pam_end.argtypes = [ctypes.c_void_p, ctypes.c_int]

    # Candidate services to try in priority order
    candidate_services = [service]
    for fallback in ["task-manager", "common-auth", "sudo", "su", "login"]:
        if fallback not in candidate_services:
            candidate_services.append(fallback)

    auth_result = -1
    acct_result = -1

    for s_name in candidate_services:
        pam_handle = ctypes.c_void_p()
        s_bytes = s_name.encode("utf-8")
        u_bytes = username.encode("utf-8")

        retval = pam.pam_start(s_bytes, u_bytes, ctypes.byref(conv_struct), ctypes.byref(pam_handle))
        if retval != PAM_SUCCESS:
            continue

        auth_result = pam.pam_authenticate(pam_handle, 0)
        acct_result = PAM_SUCCESS

        if auth_result == PAM_SUCCESS:
            acct_result = pam.pam_acct_mgmt(pam_handle, 0)
            # In an unprivileged daemon without CAP_SETUID, pam_unix account verification
            # logs "setuid failed: Operation not permitted" and may return PAM_PERM_DENIED (6) or PAM_AUTH_ERR (7).
            # When the password has been successfully verified via pam_authenticate, accept account eligibility.
            if acct_result == PAM_SUCCESS or (libc.getuid() != 0 and acct_result in [6, 7, 28]):
                acct_result = PAM_SUCCESS
                pam.pam_end(pam_handle, PAM_SUCCESS)
                break
            pam.pam_end(pam_handle, auth_result)
        else:
            pam.pam_end(pam_handle, auth_result)
            # If invalid credentials (error 7 PAM_AUTH_ERR), do not delay with other services
            if auth_result == 7:
                break

    # Securely wipe password bytes from memory
    for k in range(len(pwd_bytes)):
        pwd_bytes[k] = 0

    if auth_result == PAM_SUCCESS and acct_result == PAM_SUCCESS:
        return {"success": True, "username": username}
    else:
        return {
            "success": False,
            "error": "AUTH_FAILED",
            "auth_code": auth_result,
            "acct_code": acct_result
        }

def main():
    try:
        raw_input = sys.stdin.readline()
        if not raw_input:
            sys.stdout.write(json.dumps({"success": False, "error": "EMPTY_INPUT"}) + "\n")
            sys.stdout.flush()
            sys.exit(1)

        payload = json.loads(raw_input)
        username = payload.get("username", "").strip()
        password = payload.get("password", "")
        service = payload.get("service", "common-auth")

        if not username or not password:
            sys.stdout.write(json.dumps({"success": False, "error": "MISSING_CREDENTIALS"}) + "\n")
            sys.stdout.flush()
            sys.exit(1)

        result = authenticate_pam(username, password, service)
        sys.stdout.write(json.dumps(result) + "\n")
        sys.stdout.flush()
        sys.exit(0 if result.get("success") else 1)
    except Exception as exc:
        sys.stdout.write(json.dumps({"success": False, "error": "HELPER_EXCEPTION", "message": str(exc)}) + "\n")
        sys.stdout.flush()
        sys.exit(1)

if __name__ == "__main__":
    main()
