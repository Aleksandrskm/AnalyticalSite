from flask import Blueprint, jsonify, request, Response
import requests
from ..utils.utils import calculate_distance, calculate_azimuth, elevation_eagle, get_coordinates, communication_availability

api = Blueprint("api", __name__)

REPORT_SERVICE_URL = "http://185.192.247.60:8888"

@api.route("/report", methods=["POST"])
def proxy_report():
    json_data = request.get_json(silent=True)
    if json_data is None:
        return jsonify({"error": "Invalid JSON payload"}), 400
    # Debug: log incoming request headers and body
    try:
        print('API Proxy: incoming headers:', dict(request.headers))
    except Exception:
        print('API Proxy: incoming headers: <unserializable>')
    try:
        print('API Proxy: incoming json:', json_data)
    except Exception:
        print('API Proxy: incoming json: <unserializable>')
    try:
        print('API Proxy: forwarding POST /api/report to', f"{REPORT_SERVICE_URL}/report")
        resp = requests.post(f"{REPORT_SERVICE_URL}/report", json=json_data, timeout=30)
        print('API Proxy: remote status', resp.status_code)
        if resp.status_code >= 400:
            try:
                print('API Proxy: remote headers:', dict(resp.headers))
            except Exception:
                print('API Proxy: remote headers: <unserializable>')
            try:
                print('API Proxy: remote body (truncated):', resp.text[:2000])
            except Exception:
                print('API Proxy: remote body: <binary or unreadable>')
    except requests.RequestException as error:
        print('API Proxy: request exception', error)
        return jsonify({"error": str(error)}), 502
    content_type = resp.headers.get("Content-Type", "application/octet-stream")
    if content_type.startswith('application/json'):
        return Response(resp.text, status=resp.status_code, content_type=content_type)
    response = Response(resp.content, status=resp.status_code, content_type=content_type)
    if "Content-Disposition" in resp.headers:
        response.headers["Content-Disposition"] = resp.headers["Content-Disposition"]
    return response

@api.route("/report/<string:report_type>", methods=["POST"])
def proxy_report_type(report_type):
    if report_type not in ("csv", "docx"):
        return jsonify({"error": "Unsupported report type"}), 404
    json_data = request.get_json(silent=True)
    if json_data is None:
        return jsonify({"error": "Invalid JSON payload"}), 400
    # Debug: log incoming request headers and body
    try:
        print('API Proxy: incoming headers:', dict(request.headers))
    except Exception:
        print('API Proxy: incoming headers: <unserializable>')
    try:
        print('API Proxy: incoming json:', json_data)
    except Exception:
        print('API Proxy: incoming json: <unserializable>')
    try:
        print('API Proxy: forwarding POST /api/report/%s to %s' % (report_type, f"{REPORT_SERVICE_URL}/report/{report_type}"))
        resp = requests.post(f"{REPORT_SERVICE_URL}/report/{report_type}", json=json_data, timeout=30)
        print('API Proxy: remote status', resp.status_code)
        if resp.status_code >= 400:
            try:
                print('API Proxy: remote headers:', dict(resp.headers))
            except Exception:
                print('API Proxy: remote headers: <unserializable>')
            try:
                print('API Proxy: remote body (truncated):', resp.text[:2000])
            except Exception:
                print('API Proxy: remote body: <binary or unreadable>')
    except requests.RequestException as error:
        print('API Proxy: request exception', error)
        return jsonify({"error": str(error)}), 502
    content_type = resp.headers.get("Content-Type", "application/octet-stream")
    if content_type.startswith('application/json'):
        return Response(resp.text, status=resp.status_code, content_type=content_type)
    response = Response(resp.content, status=resp.status_code, content_type=content_type)
    if "Content-Disposition" in resp.headers:
        response.headers["Content-Disposition"] = resp.headers["Content-Disposition"]
    return response

@api.route("/ade")
def index():
    lat1 = float(request.args.get('lat1'))
    lon1 = float(request.args.get('lon1'))
    alt1 = float(request.args.get('alt1'))
    lat2 = float(request.args.get('lat2'))
    lon2 = float(request.args.get('lon2'))
    alt2 = float(request.args.get('alt2'))

    azimuth = calculate_azimuth(lat1, lon1, lat2, lon2)
    distance = calculate_distance(lat1, lon1, lat2, lon2)
    elevation = elevation_eagle(lat1, lon1, alt1, lat2, lon2, alt2)

    return jsonify({
        "azimuth": azimuth,
        "distance": distance,
        "elevation": elevation
    })


@api.route("/get_coordinates")
def index3():
    first_TLE_line = str((request.args.get('first_TLE_line')))
    second_TLE_line = str((request.args.get('second_TLE_line')))
    name = str((request.args.get('name')))
    print(first_TLE_line)
    print(second_TLE_line)
    print(name)

    response = get_coordinates(first_TLE_line, second_TLE_line, name)
    print(str(response.json()))

    return jsonify({
        "response": str(response.json())

    })

@api.route("/communication_availability")
def index4():
    acceptable_session_time_in_sec = str((request.args.get('acceptable_session_time_in_sec')))
    dates_delta_in_sec = str((request.args.get('dates_delta_in_sec')))
    interval_in_sec = str((request.args.get('interval_in_sec')))
    min_session_time_in_sec = str((request.args.get('min_session_time_in_sec')))
    start_datetime = str((request.args.get('start_datetime')))
    lat = str((request.args.get('lat')))
    lon = str((request.args.get('lon')))
    name = str((request.args.get('name')))

    response = communication_availability(acceptable_session_time_in_sec, dates_delta_in_sec, interval_in_sec, min_session_time_in_sec, start_datetime, lat, lon, name)
    import pprint
    pprint.pprint(response.json())
    return jsonify({
        "response": str(response.json())
    })

