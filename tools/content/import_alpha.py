#!/usr/bin/env python3
"""Generate compatibility catalogs from an original SMAC alpha.txt file."""

from __future__ import annotations

import argparse
import csv
import re
from dataclasses import dataclass
from pathlib import Path


TECHNOLOGY_ID_OVERRIDES = {
    "Secrets of the Human Brain": "SecretsHumanBrain",
}

TECHNOLOGY_COST_OVERRIDES = {
    "Biogenetics": 30,
    "IndustrialBase": 50,
    "InformationNetworks": 40,
    "AppliedPhysics": 50,
    "SocialPsych": 40,
    "DoctrineMobility": 30,
    "CentauriEcology": 20,
    "PlanetaryNetworks": 50,
    "DoctrineLoyalty": 60,
    "IndustrialEconomics": 70,
    "SecretsHumanBrain": 80,
}


@dataclass(frozen=True)
class TechnologyRow:
    name: str
    code: str
    prerequisite_codes: tuple[str, ...]


@dataclass(frozen=True)
class FacilityRow:
    name: str
    mineral_cost: int
    maintenance: int
    prerequisite_code: str | None
    obsolete_code: str | None
    effect: str
    kind: str


def canonical_id(name: str) -> str:
    if name in TECHNOLOGY_ID_OVERRIDES:
        return TECHNOLOGY_ID_OVERRIDES[name]
    expanded = name.replace("Adv.", "Advanced")
    words = re.findall(r"[A-Za-z0-9]+", expanded)
    return "".join(word[:1].upper() + word[1:] for word in words)


def read_section(path: Path, section: str) -> list[str]:
    lines = path.read_text(encoding="latin-1").splitlines()
    marker = f"#{section}"
    try:
        start = lines.index(marker) + 1
    except ValueError as exc:
        raise ValueError(f"{path} has no {marker} section") from exc
    result: list[str] = []
    for line in lines[start:]:
        if line.startswith("#"):
            break
        stripped = line.strip()
        if stripped and not stripped.startswith(";"):
            result.append(line)
    return result


def read_technologies(path: Path) -> list[TechnologyRow]:
    technologies: list[TechnologyRow] = []
    for line in read_section(path, "TECHNOLOGY"):
        row = next(csv.reader([line], skipinitialspace=True))
        if len(row) < 8:
            raise ValueError(f"invalid TECHNOLOGY row: {line}")
        name = row[0].strip()
        if name.lower() == "deleted" or name.startswith("User Technology "):
            continue
        prerequisite_codes = tuple(
            code for code in (row[6].strip(), row[7].strip()) if code != "None"
        )
        technologies.append(
            TechnologyRow(
                name=name,
                code=row[1].strip(),
                prerequisite_codes=prerequisite_codes,
            )
        )
    return technologies


def read_facilities(path: Path) -> list[FacilityRow]:
    facilities: list[FacilityRow] = []
    for line in read_section(path, "FACILITIES"):
        row = next(csv.reader([line], skipinitialspace=True))
        if len(row) < 6:
            raise ValueError(f"invalid FACILITIES row: {line}")
        prerequisite_code = row[3].strip()
        obsolete_code = row[4].strip()
        facilities.append(
            FacilityRow(
                name=row[0].strip(),
                mineral_cost=int(row[1].strip()) * 10,
                maintenance=int(row[2].strip()),
                prerequisite_code=(
                    None if prerequisite_code == "None" else prerequisite_code
                ),
                obsolete_code=(
                    None if obsolete_code == "Disable" else obsolete_code
                ),
                effect=row[5].strip(),
                kind="project" if len(row) > 6 else "facility",
            )
        )
    return facilities


def quote(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


def generate_technology_catalog(rows: list[TechnologyRow]) -> str:
    code_to_id: dict[str, str] = {}
    for row in rows:
        technology_id = canonical_id(row.name)
        if row.code in code_to_id:
            raise ValueError(f"duplicate technology code: {row.code}")
        if technology_id in code_to_id.values():
            raise ValueError(f"duplicate technology id: {technology_id}")
        code_to_id[row.code] = technology_id

    prerequisites: dict[str, tuple[str, ...]] = {}
    names: dict[str, str] = {}
    order: list[str] = []
    for row in rows:
        technology_id = code_to_id[row.code]
        try:
            prerequisite_ids = tuple(
                code_to_id[code] for code in row.prerequisite_codes
            )
        except KeyError as exc:
            raise ValueError(
                f"{technology_id} references missing technology code {exc.args[0]}"
            ) from exc
        prerequisites[technology_id] = prerequisite_ids
        names[technology_id] = row.name
        order.append(technology_id)

    tiers: dict[str, int] = {}
    resolving: set[str] = set()

    def get_tier(technology_id: str) -> int:
        if technology_id in tiers:
            return tiers[technology_id]
        if technology_id in resolving:
            raise ValueError(f"technology dependency cycle at {technology_id}")
        resolving.add(technology_id)
        prerequisite_ids = prerequisites[technology_id]
        tier = 0 if not prerequisite_ids else 1 + max(
            get_tier(prerequisite_id) for prerequisite_id in prerequisite_ids
        )
        resolving.remove(technology_id)
        tiers[technology_id] = tier
        return tier

    for technology_id in order:
        get_tier(technology_id)

    output = [
        "// Generated by tools/content/import_alpha.py from the original SMAC alpha.txt.",
        "// This catalog contains gameplay compatibility metadata only.",
        "const definitions = {",
    ]
    for technology_id in order:
        cost = TECHNOLOGY_COST_OVERRIDES.get(
            technology_id,
            20 + tiers[technology_id] * 10,
        )
        prerequisite_list = ", ".join(
            quote(prerequisite_id)
            for prerequisite_id in prerequisites[technology_id]
        )
        output.extend(
            [
                f"\t{technology_id}: {{",
                f"\t\tid: {quote(technology_id)},",
                f"\t\tname: {quote(names[technology_id])},",
                f"\t\tcost: {cost},",
                f"\t\tprerequisites: [{prerequisite_list}],",
                "\t},",
            ]
        )
    output.extend(
        [
            "};",
            "",
            "const order = [",
            *(f"\t{quote(technology_id)}," for technology_id in order),
            "];",
            "",
            "return {definitions: definitions, order: order};",
            "",
        ]
    )
    return "\n".join(output)


def generate_facility_catalog(
    facilities: list[FacilityRow],
    technologies: list[TechnologyRow],
) -> str:
    code_to_id = {
        technology.code: canonical_id(technology.name)
        for technology in technologies
    }
    entries: list[dict[str, str | int]] = []
    seen_ids: set[str] = set()
    for facility in facilities:
        facility_id = canonical_id(facility.name)
        if facility_id in seen_ids:
            raise ValueError(f"duplicate facility id: {facility_id}")
        seen_ids.add(facility_id)
        try:
            required_technology = (
                ""
                if facility.prerequisite_code is None
                else code_to_id[facility.prerequisite_code]
            )
            obsolete_technology = (
                ""
                if facility.obsolete_code is None
                else code_to_id[facility.obsolete_code]
            )
        except KeyError as exc:
            raise ValueError(
                f"{facility_id} references missing technology code {exc.args[0]}"
            ) from exc
        entries.append(
            {
                "id": facility_id,
                "name": facility.name,
                "kind": facility.kind,
                "mineral_cost": facility.mineral_cost,
                "energy_maintenance": facility.maintenance,
                "required_technology": required_technology,
                "obsolete_technology": obsolete_technology,
                "effect": facility.effect,
            }
        )

    output = [
        "// Generated by tools/content/import_alpha.py from the original SMAC alpha.txt.",
        "// Entries describe the complete base-game facility and secret-project catalog.",
        "const definitions = [",
    ]
    for entry in entries:
        output.extend(
            [
                "\t{",
                f"\t\tid: {quote(str(entry['id']))},",
                f"\t\tname: {quote(str(entry['name']))},",
                f"\t\tkind: {quote(str(entry['kind']))},",
                f"\t\tmineral_cost: {entry['mineral_cost']},",
                f"\t\tenergy_maintenance: {entry['energy_maintenance']},",
                f"\t\trequired_technology: {quote(str(entry['required_technology']))},",
                f"\t\tobsolete_technology: {quote(str(entry['obsolete_technology']))},",
                f"\t\teffect: {quote(str(entry['effect']))},",
                "\t},",
            ]
        )
    output.extend(["];", "", "return definitions;", ""])
    return "\n".join(output)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--alpha", type=Path, required=True)
    parser.add_argument("--technologies-output", type=Path, required=True)
    parser.add_argument("--facilities-output", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rows = read_technologies(args.alpha)
    output = generate_technology_catalog(rows)
    args.technologies_output.parent.mkdir(parents=True, exist_ok=True)
    args.technologies_output.write_text(output, encoding="ascii", newline="\n")
    print(f"wrote {len(rows)} technologies to {args.technologies_output}")
    if args.facilities_output is not None:
        facilities = read_facilities(args.alpha)
        facility_output = generate_facility_catalog(facilities, rows)
        args.facilities_output.parent.mkdir(parents=True, exist_ok=True)
        args.facilities_output.write_text(
            facility_output,
            encoding="ascii",
            newline="\n",
        )
        facility_count = sum(facility.kind == "facility" for facility in facilities)
        project_count = sum(facility.kind == "project" for facility in facilities)
        print(
            f"wrote {facility_count} facilities and {project_count} projects "
            f"to {args.facilities_output}"
        )


if __name__ == "__main__":
    main()
