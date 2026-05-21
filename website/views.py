from flask import Blueprint, render_template, url_for, request, Response
import json
import requests

views = Blueprint("views", __name__)

REPORT_SERVICE_URL = "http://185.192.247.60:8888"

@views.route('/report', methods=['POST'])
def report():
    json_data = request.get_json(silent=True)
    if json_data is None:
        return Response('{"error": "Invalid JSON payload"}', status=400, content_type='application/json')
    # Debug: log incoming request headers and body
    try:
        print('Proxy: incoming headers:', dict(request.headers))
    except Exception:
        print('Proxy: incoming headers: <unserializable>')
    try:
        print('Proxy: incoming json:', json_data)
    except Exception:
        print('Proxy: incoming json: <unserializable>')
    try:
        print('Proxy: forwarding POST /report to', f"{REPORT_SERVICE_URL}/report")
        resp = requests.post(f"{REPORT_SERVICE_URL}/report", json=json_data, timeout=30)
        print('Proxy: remote status', resp.status_code)
        if resp.status_code >= 400:
            try:
                print('Proxy: remote headers:', dict(resp.headers))
            except Exception:
                print('Proxy: remote headers: <unserializable>')
            try:
                print('Proxy: remote body (truncated):', resp.text[:2000])
            except Exception:
                print('Proxy: remote body: <binary or unreadable>')
    except requests.RequestException as error:
        print('Proxy: request exception', error)
        return Response(f'{{"error": "{error}"}}', status=502, content_type='application/json')
    # return remote response content and status; include text for easier debugging when non-binary
    content_type = resp.headers.get("Content-Type", "application/octet-stream")
    try:
        body = resp.content
    except Exception:
        body = b''
    if content_type.startswith('application/json'):
        return Response(resp.text, status=resp.status_code, content_type=content_type)
    response = Response(body, status=resp.status_code, content_type=content_type)
    if "Content-Disposition" in resp.headers:
        response.headers["Content-Disposition"] = resp.headers["Content-Disposition"]
    return response

@views.route('/report/<string:report_type>', methods=['POST'])
def report_type(report_type):
    if report_type not in ("csv", "docx"):
        return Response('{"error": "Unsupported report type"}', status=404, content_type='application/json')
    json_data = request.get_json(silent=True)
    if json_data is None:
        return Response('{"error": "Invalid JSON payload"}', status=400, content_type='application/json')
    # Debug: log incoming request headers and body
    try:
        print('Proxy: incoming headers:', dict(request.headers))
    except Exception:
        print('Proxy: incoming headers: <unserializable>')
    try:
        print('Proxy: incoming json:', json_data)
    except Exception:
        print('Proxy: incoming json: <unserializable>')
    try:
        print('Proxy: forwarding POST /report/%s to %s' % (report_type, f"{REPORT_SERVICE_URL}/report/{report_type}"))
        resp = requests.post(f"{REPORT_SERVICE_URL}/report/{report_type}", json=json_data, timeout=30)
        print('Proxy: remote status', resp.status_code)
        if resp.status_code >= 400:
            try:
                print('Proxy: remote headers:', dict(resp.headers))
            except Exception:
                print('Proxy: remote headers: <unserializable>')
            try:
                print('Proxy: remote body (truncated):', resp.text[:2000])
            except Exception:
                print('Proxy: remote body: <binary or unreadable>')
    except requests.RequestException as error:
        print('Proxy: request exception', error)
        return Response(f'{{"error": "{error}"}}', status=502, content_type='application/json')
    content_type = resp.headers.get("Content-Type", "application/octet-stream")
    if content_type.startswith('application/json'):
        return Response(resp.text, status=resp.status_code, content_type=content_type)
    response = Response(resp.content, status=resp.status_code, content_type=content_type)
    if "Content-Disposition" in resp.headers:
        response.headers["Content-Disposition"] = resp.headers["Content-Disposition"]
    return response


@views.route('/')
def index():
    return render_template('base.html')


@views.route('/azimuth_and_elevation_angle')
def function_az():
    return render_template('azimuth_and_elevation_angle.html')

@views.route('/get_coordinates')
def function_get():
    return render_template('get_coordinates.html')

@views.route('/communication_availability')
def function_com():
    return render_template('communication_availability.html')

@views.route('/viewing_tables')
def function_view():
    return render_template('viewing_tables.html')
@views.route('/pars_TLE')
def function_parse():
    return render_template('pars_TLE.html')

@views.route('/monotonous_time_service')
def function_mon_time():
    return render_template('monotonous_time_service.html')

@views.route('/abonents')
def function_abonents():
    return render_template('abonents.html')

@views.route('/maps_territorial_districts')
def function_maps():
    return render_template('maps_territorial_districts.html')
@views.route('/subsystem_of calibration_beams')
def function_beams():
    return render_template('subsystem_of calibration_beams.html')
@views.route('/plan_ochr')
def function_plan_ochr():
    return render_template('plan_ochr.html')
@views.route('/edit_KA')
def function_edit_KA():
    return render_template('edit_Ka.html')
@views.route('/system-for-view-curr-sessions')
def function_system_for_view_curr_sessions():
    return render_template('system-for-view-curr-sessions.html')


@views.route('/report/probe', methods=['GET'])
def report_probe():
    """Debug helper: probe remote report service with several candidate paths/methods."""
    candidates = [
        "/report/csv",
        "/report/docx",
        "/report",
        "/csv",
        "/docx",
        "/",
    ]
    results = {}
    test_payload = {"probe": True}
    for path in candidates:
        url = REPORT_SERVICE_URL.rstrip('/') + path
        entry = {"post": {}, "get": {}}
        # POST
        try:
            r = requests.post(url, json=test_payload, timeout=10)
            entry["post"] = {"status": r.status_code, "headers": dict(r.headers), "body": (r.text[:2000] if isinstance(r.text, str) else '<binary>')}
        except Exception as e:
            entry["post"] = {"error": str(e)}
        # GET
        try:
            r2 = requests.get(url, timeout=10)
            entry["get"] = {"status": r2.status_code, "headers": dict(r2.headers), "body": (r2.text[:2000] if isinstance(r2.text, str) else '<binary>')}
        except Exception as e:
            entry["get"] = {"error": str(e)}
        results[url] = entry
    return Response(json.dumps(results, ensure_ascii=False, indent=2), content_type='application/json')