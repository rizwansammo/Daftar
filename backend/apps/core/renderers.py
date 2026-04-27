from rest_framework.renderers import JSONRenderer


class WrappedJSONRenderer(JSONRenderer):
    def render(self, data, accepted_media_type=None, renderer_context=None):
        renderer_context = renderer_context or {}
        response = renderer_context.get("response")

        if response is None:
            return super().render(data, accepted_media_type, renderer_context)

        if isinstance(data, dict) and {"success", "data", "message", "errors"}.issubset(data.keys()):
            return super().render(data, accepted_media_type, renderer_context)

        success = 200 <= int(getattr(response, "status_code", 500)) < 400
        wrapped = {
            "success": success,
            "data": data if success else {},
            "message": "OK" if success else "Error",
            "errors": {} if success else (data or {}),
        }
        return super().render(wrapped, accepted_media_type, renderer_context)
