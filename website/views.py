from flask import Blueprint, render_template, url_for

views = Blueprint("views", __name__)


@views.route('/')
def index():
    return render_template('base.html')

@views.route('/viewing_tables')
def function_view():
    return render_template('viewing_tables.html')

@views.route('/rating-localities')
def function_rating_localities():
    return render_template('rating-localities.html')

@views.route('/rating-regions')
def function_rating_regions():
    return render_template('rating-regions.html')

@views.route('/beams')
def function_beams():
    return render_template('beams.html')
