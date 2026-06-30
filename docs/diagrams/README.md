# Propizy Report Diagrams

Open these files in **[diagrams.net](https://app.diagrams.net)** (draw.io). The database ER diagram is a **well-formed `.xml` file** (`<?xml version="1.0"?>`): use **File → Open** and select it directly.

| File | Report section |
|------|----------------|
| `propizy-use-case-diagram.xml` | **UML Use Case Diagram** — actors, 25 use cases, include relationships |
| `propizy-class-diagram.xml` | **UML Class Diagram** — 16 entity classes + 6 service classes; each with **attributes** (-) and **operations** (+) |
| `propizy-activity-tenant-registration.xml` | **UML Activity Diagram** (recommended): tenant invite &amp; registration — accurate, clean layout |
| `propizy-activity-diagram.xml` | **UML Activity Diagrams** — **3 tabs**: tenant registration/lease, M-PESA payment, cash approval |
| `propizy-4.2-context-diagram.drawio` | §4.2 Context Diagram (Level 0) |
| `propizy-4.3-dfd-level1.xml` | §4.3 DFD Level 1 (processes 1-8, balanced with context) |
| `propizy-4.3-dfd-level2.xml` | §4.3 DFD Level 2: **4 tabs**: Process 3, 4, 5, 6 decomposition |
| `propizy-4.3-dfd-level1.drawio` | DFD Level 1 (legacy draw.io copy) |
| `propizy-database-er-diagram.xml` | **Database ER Diagram**: all 23 PostgreSQL tables, Crow's Foot, `tbl` naming, FK1/FK2 |
| `propizy-4.4-er-diagram.drawio` | §4.4 ER Diagram: **two pages**: 4.4a Chen (conceptual), 4.4b Crow's Foot (logical) |

## Export for Word/PDF

1. Open file in diagrams.net  
2. **File → Export as → PNG** (300 DPI) or **PDF**  
3. Insert into report as Figure 4.1, 4.2, 4.3  

## Notation (Yourdon & Coad: course style)

| Symbol | Meaning |
|--------|---------|
| Rounded rectangle + ID header (blue) | Process |
| Plain rectangle | External entity |
| Split rectangle (`D1 \| Name`) | Data store |
| Labelled arrow | Data flow |

Context diagram = Process **0** only. Level 1 DFD decomposes Process 0 into Processes **1-8** (balanced with context boundary flows). Level 2 DFD decomposes selected Level 1 processes into sub-processes (e.g. 4.1, 4.2).

**ER diagram: Page 4.4a (Chen):** blue rectangle = entity; green oval = attribute; black diamond = relationship; crow's foot = cardinality.

**Database ER diagram (`propizy-database-er-diagram.xml`):** full PostgreSQL schema: 23 tables, Crow's Foot notation, `tbl` naming, numbered FKs, dashed lines. Cardinality follows Django constraints (mandatory vs nullable FK, OneToOne).

**ER diagram: Page 4.4b (Crow's Foot):** simplified subset; use the database diagram above for the complete schema.

**UML diagrams:** Use case (ellipse + stick figures), class (3-compartment boxes), activity (swimlanes + rounded activities + decision diamonds). Open `.xml` files via **File → Open** in diagrams.net.

## Accuracy notes

Diagrams are derived from Django models as of the current codebase:

- `backend/users/models.py`
- `backend/properties/models.py`
- `backend/payments/models.py`
- `backend/maintenance/models.py`

Chapter narrative: `docs/reports/CHAPTER_FOUR_IMPLEMENTATION.md`
