from flask import Blueprint, render_template, url_for

views = Blueprint("views", __name__)


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
@views.route('/rating-localities')
def function_rating_localities():
    return render_template('rating-localities.html')