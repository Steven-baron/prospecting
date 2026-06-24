"""Remap legacy Prospect.status values to the new prospecting-native set.

Old options:  New | Contacted | Qualified | Won | Lost  (CRM-pipeline flavored)
New options:  New | Lead | Dismissed

Mapping:
  - has a linked CRM lead  -> Lead
  - anything else legacy   -> New
(New/Lead/Dismissed are left untouched.)
"""

import frappe


def execute():
	# Records already pushed to CRM become Leads
	frappe.db.sql(
		"""
		UPDATE `tabProspect`
		SET status = 'Lead'
		WHERE status IN ('Contacted', 'Qualified', 'Won', 'Lost')
		  AND IFNULL(crm_lead, '') != ''
		"""
	)
	# Everything else with a legacy status resets to New
	frappe.db.sql(
		"""
		UPDATE `tabProspect`
		SET status = 'New'
		WHERE status IN ('Contacted', 'Qualified', 'Won', 'Lost')
		"""
	)
	frappe.db.commit()
