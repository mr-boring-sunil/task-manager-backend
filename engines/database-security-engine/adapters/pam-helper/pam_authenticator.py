#!/usr/bin/env python3
"""
Isolated Linux PAM Authentication Helper
Raspberry Pi Task Manager — Database & Security Engine

Protocol:
- Accepts single JSON line via STDIN: {"username": "...", "password": "...", "service": "task-manager"}
- Uses ctypes to invoke Linux POSIX libpam.so.0 directly.
- Validates credentials via pam_authenticate() and account eligibility via pam_acct_mgmt().
- Zero shell execution, zero command execution, zero /etc/shadow direct reading.
- Securely wipes password buffer from memory immediately following authentication.
- Emits single JSON line via STDOUT: {"success": true, "username": "..."} or {"success": false, "error": "..."}
"""

import sys
import json
import os
import platform

def authenticate_pam(username, password, service="login"):
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
            ("resp", ctypes.c_char_p),
            ("resp_retcode", ctypes.c_int)
        ]

    class PamConv(ctypes.Structure):
        pass

    conv_func_type = ctypes.CFUNCTYPE(
        ctypes.c_int,
        ctypes.c_int,
        ctypes.POINTER(ctypes.POINTER(PamMessage)),
        ctypes.POINTER(ctypes.POINTER(PamResponse)),
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
            # Allocate response array
            resp_array_type = PamResponse * num_msg
            resps = (PamResponse * num_msg)()

            for i in range(num_msg):
                m = msg_ptr[i].contents
                style = m.msg_style

                if style == PAM_PROMPT_ECHO_OFF:
                    # Password prompt
                    resp_str = bytes(pwd_bytes)
                    resps[i].resp = ctypes.c_char_p(resp_str)
                    resps[i].resp_retcode = 0
                elif style == PAM_PROMPT_ECHO_ON:
                    # Username or other input prompt
                    usr_bytes = username.encode("utf-8")
                    resps[i].resp = ctypes.c_char_p(usr_bytes)
                    resps[i].resp_retcode = 0
                else:
                    resps[i].resp = None
                    resps[i].resp_retcode = 0

            # Allocate memory using libc malloc for PAM to free
            libc_name = ctypes.util.find_library("c") or "libc.so.6"
            libc = ctypes.CDLL(libc_name)
            libc.malloc.restype = ctypes.POINTER(PamResponse)

            mem = libc.malloc(ctypes.sizeof(PamResponse) * num_msg)
            ctypes.memmove(mem, ctypes.byref(resps), ctypes.sizeof(PamResponse) * num_msg)
            resp_ptr[0] = mem
            return PAM_SUCCESS
        except Exception:
            return 19 # PAM_CONV_ERR

    conv_func = conv_func_type(conversation_callback)
    conv_struct = PamConv(conv_func, None)

    pam_handle = ctypes.c_void_p()
    service_bytes = service.encode("utf-8")
    user_bytes = username.encode("utf-8")

    pam.pam_start.restype = ctypes.c_int
    pam.pam_start.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.POINTER(PamConv), ctypes.POINTER(ctypes.c_void_p)]

    pam.pam_authenticate.restype = ctypes.c_int
    pam.pam_authenticate.argtypes = [ctypes.c_void_p, ctypes.c_int]

    pam.pam_acct_mgmt.restype = ctypes.c_int
    pam.pam_acct_mgmt.argtypes = [ctypes.c_void_p, ctypes.c_int]

    pam.pam_end.restype = ctypes.c_int
    pam.pam_end.argtypes = [ctypes.c_void_p, ctypes.c_int]

    retval = pam.pam_start(service_bytes, user_bytes, ctypes.byref(conv_struct), ctypes.byref(pam_handle))
    if retval != PAM_SUCCESS:
        # Wipe password
        for k in range(len(pwd_bytes)):
            pwd_bytes[k] = 0
        return {"success": False, "error": "PAM_START_FAILED", "code": retval}

    auth_result = pam.pam_authenticate(pam_handle, 0)
    acct_result = PAM_SUCCESS

    if auth_result == PAM_SUCCESS:
        # Verify account is eligible to log in (expiry, permissions, etc.)
        acct_result = pam.pam_acct_mgmt(pam_handle, 0)

    pam.pam_end(pam_handle, auth_result)

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
        service = payload.get("service", "login")

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
