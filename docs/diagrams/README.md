# Propizy Diagrams

Open these files in **[diagrams.net](https://app.diagrams.net)** (draw.io). Prefer well-formed `.xml` files (`<?xml version="1.0"?>`) via **File → Open**.

## Index

| File | Report section |
|------|----------------|
| `propizy-use-case-diagram.xml` | UML use case - actors, use cases, include relationships |
| `propizy-class-diagram.xml` | UML class - entities and services (attributes / operations) |
| `propizy-activity-tenant-registration.xml` | UML activity - tenant invite & registration |
| `propizy-activity-diagram.xml` | UML activity - registration/lease, M-PESA, cash approval (tabs) |
| `propizy-4.2-context-diagram.drawio` | §4.2 context diagram (Level 0) |
| `propizy-4.3-dfd-level1.xml` | §4.3 DFD Level 1 (processes 1-8) |
| `propizy-4.3-dfd-level2.xml` | §4.3 DFD Level 2 (selected process decompositions) |
| `propizy-4.3-dfd-level1.drawio` | DFD Level 1 (legacy draw.io copy) |
| `propizy-database-er-diagram.xml` | Database ER - PostgreSQL tables, Crow's Foot |
| `propizy-4.4-er-diagram.drawio` | §4.4 ER - Chen (conceptual) and Crow's Foot (logical) |

Additional focused ER files (`propizy-er-*.drawio`) cover org/auth and payments/wallet slices.

## Export for Word / PDF

1. Open the file in diagrams.net  
2. **File → Export as → PNG** (300 DPI) or **PDF**  
3. Insert into the report as the appropriate figure  

## Notation

### Yourdon & Coad (DFD)

| Symbol | Meaning |
|--------|---------|
| Rounded rectangle + ID header | Process |
| Plain rectangle | External entity |
| Split rectangle (`D1 \| Name`) | Data store |
| Labelled arrow | Data flow |

Context = Process **0**. Level 1 decomposes into processes **1-8**. Level 2 decomposes selected Level 1 processes (e.g. 4.1, 4.2).

### ER

- **Page 4.4a (Chen):** rectangle = entity; oval = attribute; diamond = relationship  
- **Database ER (`propizy-database-er-diagram.xml`):** full schema, Crow’s Foot, `tbl` naming, numbered FKs  
- **Page 4.4b (Crow's Foot):** simplified subset - use the database diagram for the complete schema  

### UML

Use case (ellipses + actors), class (three-compartment boxes), activity (swimlanes, decisions). Open `.xml` via **File → Open**.

## Source of truth

Diagrams are derived from Django models:

- `backend/users/models.py`
- `backend/properties/models.py`
- `backend/payments/models.py`
- `backend/maintenance/models.py`

Narrative: [`../reports/CHAPTER_FOUR_IMPLEMENTATION.md`](../reports/CHAPTER_FOUR_IMPLEMENTATION.md)  
Reports index: [`../reports/README.md`](../reports/README.md)
