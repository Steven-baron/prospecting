"""Register this product with bos_kit when kit is installed.

Prospecting is not a second rail. It fills CRM's chrome slot (People |
Prospecting pills). Missing kit → no-op so a lone prospecting bench still loads.
"""

try:
	from bos_kit.modules import register_module
	from bos_kit.slots import register_capability
except ImportError:
	pass
else:
	register_module(
		"prospecting",
		label="Prospecting",
		roles=["BOS: Prospecting", "Sales User", "Sales Manager"],
		grant="Sales User",
		stability="stable",
		order=32,
	)
	register_capability(
		"prospecting.mode",
		fills="crm.chrome.prospecting",
		source="prospecting",
		label="Prospecting mode",
	)
