base_template = ""
no_cache = 1

def get_context(context):
    import frappe.sessions
    context.csrf_token = frappe.sessions.get_csrf_token()
    frappe.db.commit()  # persist the generated token
