import os
import traceback
from wsgiref.simple_server import make_server


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")


if __name__ == "__main__":
    log_path = os.path.join(os.path.dirname(__file__), "dev_wsgi_server.log")
    try:
        with open(log_path, "a", encoding="utf-8") as log:
            log.write("boot\n")
            log.flush()

        from django.core.wsgi import get_wsgi_application

        application = get_wsgi_application()
        host = "127.0.0.1"
        port = 8000

        with open(log_path, "a", encoding="utf-8") as log:
            log.write(f"serving http://{host}:{port}\n")
            log.flush()

        print(f"Serving Django on http://{host}:{port}", flush=True)
        make_server(host, port, application).serve_forever()
    except BaseException:
        with open(log_path, "a", encoding="utf-8") as log:
            log.write(traceback.format_exc())
            log.flush()
        raise
