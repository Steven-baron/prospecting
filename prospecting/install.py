import frappe

# Full Google Places API (New) place type list with readable labels.
# Source: https://developers.google.com/maps/documentation/places/web-service/place-types
DEFAULT_CATEGORIES = [
	# Food & Drink
	("Restaurant",              "restaurant"),
	("Fast Food",               "fast_food_restaurant"),
	("Cafe / Coffee Shop",      "cafe"),
	("Coffee Shop",             "coffee_shop"),
	("Bar",                     "bar"),
	("Bakery",                  "bakery"),
	("Pizza",                   "pizza_restaurant"),
	("Sushi",                   "sushi_restaurant"),
	("Chinese Restaurant",      "chinese_restaurant"),
	("Indian Restaurant",       "indian_restaurant"),
	("Italian Restaurant",      "italian_restaurant"),
	("Mexican Restaurant",      "mexican_restaurant"),
	("Japanese Restaurant",     "japanese_restaurant"),
	("Thai Restaurant",         "thai_restaurant"),
	("Korean Restaurant",       "korean_restaurant"),
	("Vietnamese Restaurant",   "vietnamese_restaurant"),
	("Seafood Restaurant",      "seafood_restaurant"),
	("Steakhouse",              "steak_house"),
	("Breakfast / Brunch",      "breakfast_restaurant"),
	("Buffet",                  "buffet_restaurant"),
	("Ice Cream Shop",          "ice_cream_shop"),
	("Juice Shop",              "juice_shop"),
	("Tea House",               "tea_house"),
	("Food Court",              "food_court"),
	# Health & Medical
	("Dentist",                 "dentist"),
	("Doctor / Physician",      "doctor"),
	("Hospital",                "hospital"),
	("Pharmacy / Drugstore",    "pharmacy"),
	("Physiotherapist",         "physiotherapist"),
	("Chiropractor",            "chiropractor"),
	("Veterinary Care",         "veterinary_care"),
	("Medical Lab",             "medical_lab"),
	("Emergency Room",          "emergency_room"),
	("Optometrist",             "optometrist"),
	# Professional Services
	("Lawyer / Legal",          "lawyer"),
	("Accountant",              "accounting"),
	("Insurance Agency",        "insurance_agency"),
	("Real Estate Agency",      "real_estate_agency"),
	("Bank",                    "bank"),
	("Financial Planner",       "financial_planner"),
	("Travel Agency",           "travel_agency"),
	("Moving Company",          "moving_company"),
	("Courier / Delivery",      "courier_service"),
	("Media / Advertising",     "media_agency"),
	("Event Planner",           "event_planner"),
	("Notary Public",           "notary_public"),
	# Trades & Home Services
	("Plumber",                 "plumber"),
	("Electrician",             "electrician"),
	("General Contractor",      "general_contractor"),
	("Roofing Contractor",      "roofing_contractor"),
	("Pest Control",            "pest_control"),
	("Locksmith",               "locksmith"),
	("HVAC / Heating",          "hvac_contractor"),
	("Painting Contractor",     "painter"),
	("Landscaper",              "landscaper"),
	# Automotive
	("Car Repair / Auto Shop",  "car_repair"),
	("Car Dealer",              "car_dealer"),
	("Car Rental",              "car_rental"),
	("Car Wash",                "car_wash"),
	("Gas Station",             "gas_station"),
	("Tire Shop",               "tire_shop"),
	# Beauty & Wellness
	("Hair Salon",              "hair_salon"),
	("Beauty Salon",            "beauty_salon"),
	("Nail Salon",              "nail_salon"),
	("Spa",                     "spa"),
	("Barber Shop",             "barber_shop"),
	("Tattoo Parlor",           "tattoo_parlor"),
	("Massage Therapist",       "massage"),
	# Fitness & Recreation
	("Gym / Fitness Center",    "gym"),
	("Yoga Studio",             "yoga"),
	("Sports Club",             "sports_club"),
	("Swimming Pool",           "swimming_pool"),
	("Golf Course",             "golf_course"),
	("Tennis Court",            "tennis_court"),
	("Bowling Alley",           "bowling_alley"),
	# Retail & Shopping
	("Grocery Store",           "grocery_store"),
	("Convenience Store",       "convenience_store"),
	("Clothing Store",          "clothing_store"),
	("Shoe Store",              "shoe_store"),
	("Electronics Store",       "electronics_store"),
	("Hardware Store",          "hardware_store"),
	("Home Improvement Store",  "home_improvement_store"),
	("Furniture Store",         "furniture_store"),
	("Jewelry Store",           "jewelry_store"),
	("Bookstore",               "book_store"),
	("Pet Store",               "pet_store"),
	("Florist",                 "florist"),
	("Gift Shop",               "gift_shop"),
	("Bicycle Store",           "bicycle_store"),
	("Sporting Goods",          "sporting_goods_store"),
	("Toy Store",               "toy_store"),
	("Pharmacy",                "drugstore"),
	("Shopping Mall",           "shopping_mall"),
	("Supermarket",             "supermarket"),
	# Education
	("School",                  "school"),
	("University / College",    "university"),
	("Preschool / Daycare",     "preschool"),
	("Child Care",              "child_care_agency"),
	("Driving School",          "driving_school"),
	("Library",                 "library"),
	# Lodging & Hospitality
	("Hotel",                   "hotel"),
	("Motel",                   "motel"),
	("Bed & Breakfast",         "bed_and_breakfast"),
	("Hostel",                  "hostel"),
	("Campground",              "campground"),
	# Entertainment
	("Movie Theater",           "movie_theater"),
	("Night Club",              "night_club"),
	("Amusement Park",          "amusement_park"),
	("Museum",                  "museum"),
	("Art Gallery",             "art_gallery"),
	("Casino",                  "casino"),
	("Comedy Club",             "comedy_club"),
	("Zoo / Aquarium",          "zoo"),
	# Government & Services
	("Post Office",             "post_office"),
	("Bank / ATM",              "atm"),
	("Police Station",          "police"),
	("Fire Station",            "fire_station"),
	("Storage Facility",        "storage"),
	("Recycling Center",        "recycling_center"),
	("Funeral Home",            "funeral_home"),
	("Animal Shelter",          "animal_shelter"),
	("Pet Grooming",            "pet_grooming"),
	# Places of Worship
	("Church",                  "church"),
	("Mosque",                  "mosque"),
	("Synagogue",               "synagogue"),
	("Hindu Temple",            "hindu_temple"),
]


def after_install():
	_setup_crm_custom_fields()
	_populate_default_categories()


def _setup_crm_custom_fields():
	"""Create custom fields on CRM Lead and CRM Organization."""
	FIELDS = [
		dict(dt='CRM Lead', fieldname='custom_prospect', label='Source Prospect',
		     fieldtype='Link', options='Prospect', insert_after='source', read_only=1),
		dict(dt='CRM Lead', fieldname='custom_google_rating', label='Google Rating',
		     fieldtype='Float', insert_after='custom_prospect', read_only=1),
		dict(dt='CRM Organization', fieldname='custom_prospect', label='Source Prospect',
		     fieldtype='Link', options='Prospect', insert_after='website', read_only=1),
		dict(dt='CRM Organization', fieldname='custom_google_rating', label='Google Rating',
		     fieldtype='Float', insert_after='custom_prospect', read_only=1),
		dict(dt='CRM Organization', fieldname='custom_google_maps_url', label='Google Maps URL',
		     fieldtype='Data', options='URL', insert_after='custom_google_rating', read_only=1),
		dict(dt='CRM Organization', fieldname='custom_address_text', label='Address',
		     fieldtype='Small Text', insert_after='custom_google_maps_url', read_only=1),
	]
	for f in FIELDS:
		name = f'{f["dt"]}-{f["fieldname"]}'
		if not frappe.db.exists('Custom Field', name):
			cf = frappe.new_doc('Custom Field')
			cf.update(f)
			cf.insert(ignore_permissions=True)
	frappe.db.commit()


def _populate_default_categories():
	"""Seed Prospecting Settings with the default Google place type list."""
	settings = frappe.get_single('Prospecting Settings')
	if settings.categories:
		return  # already configured — don't overwrite user's list
	for label, value in DEFAULT_CATEGORIES:
		settings.append('categories', {'label': label, 'value': value})
	settings.save(ignore_permissions=True)
	frappe.db.commit()
