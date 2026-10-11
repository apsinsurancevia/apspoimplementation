"""Create master Google Sheets by uploading .xlsx (Drive convert). No Sheets API needed."""
import json
import os
import io
import requests
from openpyxl import Workbook

ROOT = r"d:\HRSrini\caliber-po"
CLASPRC = os.path.join(os.environ["USERPROFILE"], ".clasprc.json")
OUT = os.path.join(ROOT, "deploy_setup_ids.local.json")

FOLDERS = {
    "ROOT": "1KZBvUZyt1Y8l0-hfNa6nz5SLkENEnsue",
    "MASTERS": "1hxNk6XjbZwUfeeFgOtbFSJKi9J7rMokz",
    "CONFIG": "1HufN1qA5fvMe6GNFlalkvyFmEPIRuGgE",
    "GRIDS": "125lwRE7R-NSNnHolBGIBA_z3kLm4-vT2",
    "GRID_IMPORT": "1-h1bFSfpP8yZxejdK95IEXXbmfjnbBb7",
    "GRID_ARCHIVE": "1bpxRcEnSxnjnss2cgvFgydRbtmF4ACMv",
    "INPUT": "1hsnV7phJt7f1qDQc4zp8YZ732z8VtUX0",
    "OUTPUT": "17UeDCGTHhHNRJtJtVZ1U8I2CQmeCEUxT",
    "STATEMENTS": "1R03oxUxSQeP2y-ja2KKjqEJOvGAg3oDw",
    "INVOICES": "19GAc9faQ9Sw0LPTNATvpRdmrKbIeHydL",
    "INVOICES_PARTNER": "1QXeJVhcfeWnNdR_nNZseRuspzVm5-4Gq",
    "INVOICES_INSURER": "1BJz9UVDYvWgo4J_FUY2OHwiddaSZhrJN",
    "RECONCILIATION": "133awcnVEAqUYqBBMhjIO5_F0DXpI-jJy",
    "BACKUP": "1xL3CSTCAi_iDZwTcgx-32mSyPwcoTmvj",
    "LOG": "1W4HxYC7fZbaV7TaaxUNGWBRqOT9P2mun",
}

PRODUCT_MASTER_DATA = [
    ["Motor","TW","New (1+5)","Scooter","New Business","Y"],
    ["Motor","TW","New (1+5)","Bike","New Business","Y"],
    ["Motor","TW","New (5+5)","Scooter","New Business","Y"],
    ["Motor","TW","New (5+5)","Bike","New Business","Y"],
    ["Motor","TW","1+1","Scooter","New Business / Renewal","Y"],
    ["Motor","TW","1+1","Bike","New Business / Renewal","Y"],
    ["Motor","TW","SAOD","Scooter","New Business / Renewal","Y"],
    ["Motor","TW","SAOD","Bike","New Business / Renewal","Y"],
    ["Motor","TW","SATP","Scooter","New Business / Renewal","Y"],
    ["Motor","TW","SATP","Bike","New Business / Renewal","Y"],
    ["Motor","Pvt Car","New (1+3)","","New Business","Y"],
    ["Motor","Pvt Car","New (3+3)","","New Business","Y"],
    ["Motor","Pvt Car","1+1","","New Business / Renewal","Y"],
    ["Motor","Pvt Car","SAOD","","New Business / Renewal","Y"],
    ["Motor","Pvt Car","SATP","","New Business / Renewal","Y"],
    ["Motor","GCV","1+1","3W","New Business / Renewal","Y"],
    ["Motor","GCV","1+1","Tanker","New Business / Renewal","Y"],
    ["Motor","GCV","1+1","Water Tanker","New Business / Renewal","Y"],
    ["Motor","GCV","1+1","Car Carrier","New Business / Renewal","Y"],
    ["Motor","GCV","1+1","Flatbed","New Business / Renewal","Y"],
    ["Motor","GCV","1+1","Oil Tanker","New Business / Renewal","Y"],
    ["Motor","GCV","SATP","3W","New Business / Renewal","Y"],
    ["Motor","GCV","SATP","Tanker","New Business / Renewal","Y"],
    ["Motor","GCV","SATP","Water Tanker","New Business / Renewal","Y"],
    ["Motor","GCV","SATP","Car Carrier","New Business / Renewal","Y"],
    ["Motor","GCV","SATP","Flatbed","New Business / Renewal","Y"],
    ["Motor","GCV","SATP","Oil Tanker","New Business / Renewal","Y"],
    ["Motor","PCV","1+1","3W","New Business / Renewal","Y"],
    ["Motor","PCV","1+1","Taxi 4+1","New Business / Renewal","Y"],
    ["Motor","PCV","1+1","Taxi 5+1","New Business / Renewal","Y"],
    ["Motor","PCV","1+1","Taxi>7","New Business / Renewal","Y"],
    ["Motor","PCV","1+1","Bus<12","New Business / Renewal","Y"],
    ["Motor","PCV","1+1","Bus>12<36","New Business / Renewal","Y"],
    ["Motor","PCV","1+1","Bus>36","New Business / Renewal","Y"],
    ["Motor","PCV","1+1","School Bus","New Business / Renewal","Y"],
    ["Motor","PCV","1+1","Staff Bus","New Business / Renewal","Y"],
    ["Motor","PCV","SATP","3W","New Business / Renewal","Y"],
    ["Motor","PCV","SATP","Taxi 4+1","New Business / Renewal","Y"],
    ["Motor","PCV","SATP","Bus<12","New Business / Renewal","Y"],
    ["Motor","PCV","SATP","Bus>36","New Business / Renewal","Y"],
    ["Motor","PCV","SATP","School Bus","New Business / Renewal","Y"],
    ["Motor","PCV","SATP","Staff Bus","New Business / Renewal","Y"],
    ["Misc D","Tractor","1+1","Excavator","New Business / Renewal","Y"],
    ["Misc D","Tractor","1+1","Harvester","New Business / Renewal","Y"],
    ["Misc D","Tractor","1+1","Agri Tractor","New Business / Renewal","Y"],
    ["Misc D","Tractor","SATP","Excavator","New Business / Renewal","Y"],
    ["Misc D","Tractor","SATP","Harvester","New Business / Renewal","Y"],
    ["Misc D","Tractor","SATP","Agri Tractor","New Business / Renewal","Y"],
    ["Misc D","Construction Eqpt","1+1","","New Business / Renewal","Y"],
    ["Misc D","Construction Eqpt","SATP","","New Business / Renewal","Y"],
]

INSURER_MASTER_DATA = [
    ["OR","THE ORIENTAL INSURANCE CO LTD","[GSTIN]","DELHI","DL","[ADDRESS]","997131","[SPOC_EMAIL]","Y"],
    ["NIC","NATIONAL INSURANCE CO LTD","[GSTIN]","WEST BENGAL","WB","[ADDRESS]","997131","[SPOC_EMAIL]","Y"],
    ["UIIC","UNITED INDIA INSURANCE CO LTD","[GSTIN]","TAMILNADU","TN","[ADDRESS]","997131","[SPOC_EMAIL]","Y"],
    ["USGI","UNIVERSAL SOMPO GENERAL INSURANCE CO LTD","[GSTIN]","MAHARASHTRA","MH","[ADDRESS]","997131","[SPOC_EMAIL]","Y"],
    ["TATA","TATA AIG GENERAL INSURANCE CO LTD","[GSTIN]","MAHARASHTRA","MH","[ADDRESS]","997131","[SPOC_EMAIL]","Y"],
    ["BAJAJ","BAJAJ ALLIANZ GENERAL INSURANCE CO LTD","[GSTIN]","MAHARASHTRA","MH","[ADDRESS]","997131","[SPOC_EMAIL]","Y"],
    ["GO","GO DIGIT GENERAL INSURANCE LTD","[GSTIN]","KARNATAKA","KA","[ADDRESS]","997131","[SPOC_EMAIL]","Y"],
    ["INDUSIND","INDUSIND GENERAL INSURANCE CO LTD","[GSTIN]","[STATE]","[CODE]","[ADDRESS]","997131","[SPOC_EMAIL]","Y"],
    ["NIA","THE NEW INDIA ASSURANCE CO LTD","[GSTIN]","MAHARASHTRA","MH","[ADDRESS]","997131","[SPOC_EMAIL]","Y"],
]


def access_token():
    rc = json.load(open(CLASPRC, encoding="utf-8"))
    t = rc["tokens"]["default"]
    r = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": t["client_id"],
            "client_secret": t["client_secret"],
            "refresh_token": t["refresh_token"],
            "grant_type": "refresh_token",
        },
        timeout=60,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def wb_bytes(sheets):
    """sheets: list of (title, rows) where rows include header row."""
    wb = Workbook()
    first = True
    for title, rows in sheets:
        if first:
            ws = wb.active
            ws.title = title[:31]
            first = False
        else:
            ws = wb.create_sheet(title[:31])
        for row in rows:
            ws.append(list(row))
    bio = io.BytesIO()
    wb.save(bio)
    return bio.getvalue()


def upload_xlsx(token, parent_id, name, xlsx_bytes):
    meta = {
        "name": name,
        "mimeType": "application/vnd.google-apps.spreadsheet",
        "parents": [parent_id],
    }
    files = {
        "metadata": ("metadata", json.dumps(meta), "application/json"),
        "file": ("file.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    }
    r = requests.post(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
        timeout=120,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"upload {name}: {r.status_code} {r.text[:500]}")
    j = r.json()
    print(f"uploaded {name} -> {j['id']}")
    return j["id"]


def trash(token, file_id):
    requests.patch(
        f"https://www.googleapis.com/drive/v3/files/{file_id}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"trashed": True},
        timeout=60,
    )


def main():
    token = access_token()
    # remove empty Product Master from earlier attempt
    trash(token, "1jSfKkXIbSGAdt-Z6zSlGN5E3661Ogw-tw1EP-GLxNMU")

    sheets = {}
    sheets["PRODUCT_MASTER"] = upload_xlsx(
        token,
        FOLDERS["MASTERS"],
        "Product Master",
        wb_bytes([
            (
                "Motor",
                [["product_vertical","product_type","product_sub_type","product_sub_sub_type","policy_type","active"]]
                + PRODUCT_MASTER_DATA,
            )
        ]),
    )
    sheets["RTO_MASTER"] = upload_xlsx(
        token,
        FOLDERS["MASTERS"],
        "RTO Master",
        wb_bytes([("RTO", [["rto_id","rto_city","state_name","rto_code","state_code"]])]),
    )
    sheets["INSURER_MASTER"] = upload_xlsx(
        token,
        FOLDERS["MASTERS"],
        "Insurer Master",
        wb_bytes([
            (
                "Insurers",
                [["insurer_id","insurer_name","insurer_gstin","insurer_state","insurer_state_code","insurer_address","sac_code","spoc_email","active"]]
                + INSURER_MASTER_DATA,
            )
        ]),
    )
    sheets["BROKER_CONFIG"] = upload_xlsx(
        token,
        FOLDERS["CONFIG"],
        "CaliberPO Config",
        wb_bytes([
            ("Field_Mapping", [["broker_field","standard_field","transform","notes"]]),
            ("Insurer_Code_Map", [["broker_value","caliber_insurer_id","notes"]]),
            ("Product_Map", [["broker_field","broker_value","caliber_field","caliber_value","notes"]]),
            ("Derivation_Rules", [["rule_type","keyword","derived_value","notes"]]),
            ("Counters", [["counter_name","current_value"], ["PARTNER_INVOICE_COUNTER", 0], ["INSURER_INVOICE_COUNTER", 0]]),
            ("Prompts", [["insurer_id","prompt_template","notes"]]),
        ]),
    )
    sheets["PARTNER_MASTER"] = upload_xlsx(
        token,
        FOLDERS["CONFIG"],
        "Partner Master",
        wb_bytes([(
            "Partners",
            [[
                "posp_id","posp_name","dealer_name","manager","rm",
                "partner_email","partner_mobile","pan_number","gstin",
                "partner_legal_name","partner_address","partner_state","partner_state_code","partner_pan",
                "bank_account_name","bank_name","bank_branch","account_number","ifsc_code","account_type",
                "tds_rate_override","active","statement_sent","utr_number","payment_date",
            ]],
        )]),
    )
    sheets["LOG"] = upload_xlsx(
        token,
        FOLDERS["LOG"],
        "CaliberPO Log",
        wb_bytes([
            ("Log_Active", [["timestamp","function_name","caller_type","insurer_id","product_type","rto","match_type","match_status","response_ms","notes","fuel_type","yom"]]),
            ("Log_Summary", [["period","total_calls","matched","no_match","errors","avg_response_ms"]]),
            ("Log_Dashboard", [["placeholder"]]),
            ("processed_policies", [["policy_no","period","processed_at","source_file"]]),
            ("Run_Log", [["timestamp","function_name","trigger_type","run_status","error_message","error_function","duration_seconds"]]),
        ]),
    )
    sheets["RECONCILIATION"] = upload_xlsx(
        token,
        FOLDERS["RECONCILIATION"],
        "Reconciliation",
        wb_bytes([("Index", [["insurer_id","insurer_name","last_run","total_outstanding","total_variance","notes"]])]),
    )

    result = {
        "success": True,
        "rootFolderUrl": f"https://drive.google.com/drive/folders/{FOLDERS['ROOT']}",
        "folders": FOLDERS,
        "sheets": sheets,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print("Wrote", OUT)
    print("ROOT", result["rootFolderUrl"])


if __name__ == "__main__":
    main()
