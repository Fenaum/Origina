"""Generate synthetic MISMO XML fixtures from source samples.

The generator keeps the original MISMO document shape intact and only mutates
common high-value testing fields such as loan amount, property address,
borrower names, fake tax IDs, occupancy, purpose, and selected dates.
"""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parent
SOURCE_DIR = ROOT / "sources"
GENERATED_DIR = ROOT / "generated"

MISMO_NS = "http://www.mismo.org/residential/2009/schemas"

ET.register_namespace("", MISMO_NS)
ET.register_namespace("xsi", "http://www.w3.org/2001/XMLSchema-instance")
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
ET.register_namespace("ULAD", "http://www.datamodelextension.org/Schema/ULAD")
ET.register_namespace("DU", "http://www.datamodelextension.org/Schema/DU")


def local_name(tag: str) -> str:
    """Return the XML local name without the namespace wrapper."""
    return tag.rsplit("}", 1)[-1]


def descendants_by_name(root: ET.Element, name: str) -> list[ET.Element]:
    """Find all descendants with a specific local tag name."""
    return [element for element in root.iter() if local_name(element.tag) == name]


def set_all(root: ET.Element, name: str, value: str) -> None:
    """Update every element matching a local tag name."""
    for element in descendants_by_name(root, name):
        element.text = value


def set_first(root: ET.Element, name: str, value: str) -> None:
    """Update the first element matching a local tag name."""
    elements = descendants_by_name(root, name)
    if elements:
        elements[0].text = value


def set_sequence(root: ET.Element, name: str, values: list[str]) -> None:
    """Update matching elements in sequence, repeating the final value as needed."""
    elements = descendants_by_name(root, name)
    for index, element in enumerate(elements):
        element.text = values[min(index, len(values) - 1)]


def first_descendant(parent: ET.Element, name: str) -> ET.Element | None:
    """Find the first descendant below a specific parent by local tag name."""
    for element in parent.iter():
        if local_name(element.tag) == name:
            return element
    return None


def set_subject_address(root: ET.Element, spec: dict[str, object]) -> None:
    """Update the subject property address while leaving other address blocks intact."""
    subject_property = first_descendant(root, "SUBJECT_PROPERTY")
    address_parent = first_descendant(subject_property, "ADDRESS") if subject_property is not None else None
    target = address_parent or root

    address_map = {
        "AddressLineText": spec["address"],
        "CityName": spec["city"],
        "CountyName": spec["county"],
        "StateCode": spec["state"],
        "PostalCode": spec["postal_code"],
    }
    for tag_name, value in address_map.items():
        element = first_descendant(target, tag_name)
        if element is not None:
            element.text = str(value)


def mutate_tree(source_path: Path, spec: dict[str, object]) -> ET.ElementTree:
    """Load a source XML file and apply one synthetic scenario spec."""
    tree = ET.parse(source_path)
    root = tree.getroot()

    borrower_names = spec["borrowers"]
    first_names = [name.split(" ", 1)[0] for name in borrower_names]
    last_names = [name.split(" ", 1)[1] for name in borrower_names]
    full_names = [f"{first} {last}" for first, last in zip(first_names, last_names)]

    set_first(root, "CreatedDatetime", str(spec["created_at"]))
    set_sequence(root, "FirstName", first_names)
    set_sequence(root, "LastName", last_names)
    set_sequence(root, "FullName", full_names)
    set_sequence(root, "TaxpayerIdentifierValue", list(spec["fake_tax_ids"]))
    set_subject_address(root, spec)

    set_all(root, "BaseLoanAmount", f"{spec['loan_amount']:.2f}")
    set_all(root, "PropertyEstimatedValueAmount", f"{spec['property_value']:.2f}")
    set_all(root, "PropertyValuationAmount", f"{spec['property_value']:.2f}")
    set_all(root, "SalesContractAmount", f"{spec['purchase_price']:.2f}")
    set_all(root, "LoanPurposeType", str(spec["purpose"]))
    set_all(root, "PropertyUsageType", str(spec["occupancy"]))
    set_all(root, "PropertyCurrentUsageType", str(spec["occupancy"]))
    set_all(root, "MortgageType", str(spec["mortgage_type"]))

    for index, identifier in enumerate(descendants_by_name(root, "LoanIdentifier"), start=1):
        identifier.text = f"{spec['fixture_id']}-{index:02d}"

    return tree


VARIANTS: list[dict[str, object]] = [
    {
        "fixture_id": "OriginaCommercialVariant001",
        "source": "CommercialTest5.xml",
        "description": "DSCR-style investment refinance in Texas",
        "created_at": "2026-01-12T09:15:00-06:00",
        "borrowers": ["Jordan Rivers", "Maya Rivers"],
        "fake_tax_ids": ["900010001", "900010002"],
        "address": "4401 Travis Street",
        "city": "Dallas",
        "county": "Dallas",
        "state": "TX",
        "postal_code": "75205",
        "loan_amount": 525000.00,
        "property_value": 720000.00,
        "purchase_price": 0.00,
        "purpose": "Refinance",
        "occupancy": "Investment",
        "mortgage_type": "Conventional",
    },
    {
        "fixture_id": "OriginaCommercialVariant002",
        "source": "CommercialTest5.xml",
        "description": "Investment refinance in Florida with larger balance",
        "created_at": "2026-01-18T11:40:00-05:00",
        "borrowers": ["Luis Herrera", "Camila Herrera"],
        "fake_tax_ids": ["900010003", "900010004"],
        "address": "811 Brickell Avenue",
        "city": "Miami",
        "county": "Miami-Dade",
        "state": "FL",
        "postal_code": "33131",
        "loan_amount": 780000.00,
        "property_value": 1040000.00,
        "purchase_price": 0.00,
        "purpose": "Refinance",
        "occupancy": "Investment",
        "mortgage_type": "Conventional",
    },
    {
        "fixture_id": "OriginaCommercialVariant003",
        "source": "CommercialTest5.xml",
        "description": "Cash-out investment refinance in Georgia",
        "created_at": "2026-02-02T14:05:00-05:00",
        "borrowers": ["Priya Shah", "Nikhil Shah"],
        "fake_tax_ids": ["900010005", "900010006"],
        "address": "1280 Peachtree Street NE",
        "city": "Atlanta",
        "county": "Fulton",
        "state": "GA",
        "postal_code": "30309",
        "loan_amount": 650000.00,
        "property_value": 915000.00,
        "purchase_price": 0.00,
        "purpose": "CashOutRefinance",
        "occupancy": "Investment",
        "mortgage_type": "Conventional",
    },
    {
        "fixture_id": "OriginaCommercialVariant004",
        "source": "CommercialTest5.xml",
        "description": "Investment purchase in North Carolina",
        "created_at": "2026-02-20T10:25:00-05:00",
        "borrowers": ["Elena Morgan", "Victor Morgan"],
        "fake_tax_ids": ["900010007", "900010008"],
        "address": "201 South College Street",
        "city": "Charlotte",
        "county": "Mecklenburg",
        "state": "NC",
        "postal_code": "28202",
        "loan_amount": 455000.00,
        "property_value": 675000.00,
        "purchase_price": 675000.00,
        "purpose": "Purchase",
        "occupancy": "Investment",
        "mortgage_type": "Conventional",
    },
    {
        "fixture_id": "OriginaCommercialVariant005",
        "source": "CommercialTest5.xml",
        "description": "High-balance investment refinance in Arizona",
        "created_at": "2026-03-04T08:55:00-07:00",
        "borrowers": ["Noah Bennett", "Avery Bennett"],
        "fake_tax_ids": ["900010009", "900010010"],
        "address": "7120 East Camelback Road",
        "city": "Scottsdale",
        "county": "Maricopa",
        "state": "AZ",
        "postal_code": "85251",
        "loan_amount": 935000.00,
        "property_value": 1240000.00,
        "purchase_price": 0.00,
        "purpose": "Refinance",
        "occupancy": "Investment",
        "mortgage_type": "Conventional",
    },
    {
        "fixture_id": "OriginaConsumerVariant001",
        "source": "ConsumerTest3.xml",
        "description": "Primary residence purchase in Colorado",
        "created_at": "2026-01-09T13:35:00-07:00",
        "borrowers": ["Sofia Alvarez", "Mateo Alvarez"],
        "fake_tax_ids": ["900020001", "900020002"],
        "address": "1725 Blake Street",
        "city": "Denver",
        "county": "Denver",
        "state": "CO",
        "postal_code": "80202",
        "loan_amount": 365000.00,
        "property_value": 500000.00,
        "purchase_price": 500000.00,
        "purpose": "Purchase",
        "occupancy": "PrimaryResidence",
        "mortgage_type": "Conventional",
    },
    {
        "fixture_id": "OriginaConsumerVariant002",
        "source": "ConsumerTest3.xml",
        "description": "Primary residence purchase in Texas",
        "created_at": "2026-01-26T15:20:00-06:00",
        "borrowers": ["Marcus Lee", "Naomi Lee"],
        "fake_tax_ids": ["900020003", "900020004"],
        "address": "98 San Jacinto Boulevard",
        "city": "Austin",
        "county": "Travis",
        "state": "TX",
        "postal_code": "78701",
        "loan_amount": 420000.00,
        "property_value": 560000.00,
        "purchase_price": 560000.00,
        "purpose": "Purchase",
        "occupancy": "PrimaryResidence",
        "mortgage_type": "Conventional",
    },
    {
        "fixture_id": "OriginaConsumerVariant003",
        "source": "ConsumerTest3.xml",
        "description": "Primary residence purchase in Washington",
        "created_at": "2026-02-08T09:45:00-08:00",
        "borrowers": ["Grace Kim", "Daniel Kim"],
        "fake_tax_ids": ["900020005", "900020006"],
        "address": "1201 3rd Avenue",
        "city": "Seattle",
        "county": "King",
        "state": "WA",
        "postal_code": "98101",
        "loan_amount": 640000.00,
        "property_value": 820000.00,
        "purchase_price": 820000.00,
        "purpose": "Purchase",
        "occupancy": "PrimaryResidence",
        "mortgage_type": "Conventional",
    },
    {
        "fixture_id": "OriginaConsumerVariant004",
        "source": "ConsumerTest3.xml",
        "description": "Primary residence refinance in Oregon",
        "created_at": "2026-02-14T12:10:00-08:00",
        "borrowers": ["Ethan Brooks", "Harper Brooks"],
        "fake_tax_ids": ["900020007", "900020008"],
        "address": "900 SW 5th Avenue",
        "city": "Portland",
        "county": "Multnomah",
        "state": "OR",
        "postal_code": "97204",
        "loan_amount": 310000.00,
        "property_value": 470000.00,
        "purchase_price": 0.00,
        "purpose": "Refinance",
        "occupancy": "PrimaryResidence",
        "mortgage_type": "Conventional",
    },
    {
        "fixture_id": "OriginaConsumerVariant005",
        "source": "ConsumerTest3.xml",
        "description": "Primary residence purchase in Illinois",
        "created_at": "2026-03-01T16:30:00-06:00",
        "borrowers": ["Amara Johnson", "Caleb Johnson"],
        "fake_tax_ids": ["900020009", "900020010"],
        "address": "233 South Wacker Drive",
        "city": "Chicago",
        "county": "Cook",
        "state": "IL",
        "postal_code": "60606",
        "loan_amount": 510000.00,
        "property_value": 690000.00,
        "purchase_price": 690000.00,
        "purpose": "Purchase",
        "occupancy": "PrimaryResidence",
        "mortgage_type": "Conventional",
    },
    {
        "fixture_id": "OriginaHighBalanceVariant001",
        "source": "ConsumerTest7.xml",
        "description": "Second home purchase in New Jersey",
        "created_at": "2026-01-15T10:05:00-05:00",
        "borrowers": ["Owen Carter", "Lena Carter"],
        "fake_tax_ids": ["900030001", "900030002"],
        "address": "180 River Road",
        "city": "Summit",
        "county": "Union",
        "state": "NJ",
        "postal_code": "07901",
        "loan_amount": 725000.00,
        "property_value": 945000.00,
        "purchase_price": 945000.00,
        "purpose": "Purchase",
        "occupancy": "SecondHome",
        "mortgage_type": "Conventional",
    },
    {
        "fixture_id": "OriginaHighBalanceVariant002",
        "source": "ConsumerTest7.xml",
        "description": "Primary residence purchase in California",
        "created_at": "2026-01-29T09:25:00-08:00",
        "borrowers": ["Mila Patel", "Arjun Patel"],
        "fake_tax_ids": ["900030003", "900030004"],
        "address": "525 Market Street",
        "city": "San Francisco",
        "county": "San Francisco",
        "state": "CA",
        "postal_code": "94105",
        "loan_amount": 975000.00,
        "property_value": 1225000.00,
        "purchase_price": 1225000.00,
        "purpose": "Purchase",
        "occupancy": "PrimaryResidence",
        "mortgage_type": "Conventional",
    },
    {
        "fixture_id": "OriginaHighBalanceVariant003",
        "source": "ConsumerTest7.xml",
        "description": "Investment purchase in Florida",
        "created_at": "2026-02-11T14:15:00-05:00",
        "borrowers": ["Jasper Cole", "Iris Cole"],
        "fake_tax_ids": ["900030005", "900030006"],
        "address": "777 South Flagler Drive",
        "city": "West Palm Beach",
        "county": "Palm Beach",
        "state": "FL",
        "postal_code": "33401",
        "loan_amount": 840000.00,
        "property_value": 1080000.00,
        "purchase_price": 1080000.00,
        "purpose": "Purchase",
        "occupancy": "Investment",
        "mortgage_type": "Conventional",
    },
    {
        "fixture_id": "OriginaHighBalanceVariant004",
        "source": "ConsumerTest7.xml",
        "description": "Second home refinance in Virginia",
        "created_at": "2026-02-24T11:50:00-05:00",
        "borrowers": ["Nora Mitchell", "Eli Mitchell"],
        "fake_tax_ids": ["900030007", "900030008"],
        "address": "1199 North Fairfax Street",
        "city": "Alexandria",
        "county": "Alexandria",
        "state": "VA",
        "postal_code": "22314",
        "loan_amount": 590000.00,
        "property_value": 790000.00,
        "purchase_price": 0.00,
        "purpose": "Refinance",
        "occupancy": "SecondHome",
        "mortgage_type": "Conventional",
    },
    {
        "fixture_id": "OriginaHighBalanceVariant005",
        "source": "ConsumerTest7.xml",
        "description": "Primary residence cash-out refinance in Maryland",
        "created_at": "2026-03-07T13:05:00-05:00",
        "borrowers": ["Claire Donovan", "Miles Donovan"],
        "fake_tax_ids": ["900030009", "900030010"],
        "address": "7200 Wisconsin Avenue",
        "city": "Bethesda",
        "county": "Montgomery",
        "state": "MD",
        "postal_code": "20814",
        "loan_amount": 675000.00,
        "property_value": 930000.00,
        "purchase_price": 0.00,
        "purpose": "CashOutRefinance",
        "occupancy": "PrimaryResidence",
        "mortgage_type": "Conventional",
    },
]


def main() -> None:
    """Generate variant XML files and a JSON manifest."""
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "generated_by": "test-fixtures/mismo/generate_mismo_variants.py",
        "note": "Synthetic MISMO fixtures for parser and workflow testing. Fake borrower and tax ID data only.",
        "sources": sorted(path.name for path in SOURCE_DIR.glob("*.xml")),
        "variants": [],
    }

    for spec in VARIANTS:
        source_path = SOURCE_DIR / str(spec["source"])
        output_name = f"{spec['fixture_id']}.xml"
        output_path = GENERATED_DIR / output_name
        tree = mutate_tree(source_path, deepcopy(spec))
        tree.write(output_path, encoding="utf-8", xml_declaration=True)

        public_spec = {
            key: value
            for key, value in spec.items()
            if key not in {"fake_tax_ids"}
        }
        public_spec["file"] = f"generated/{output_name}"
        manifest["variants"].append(public_spec)

    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
