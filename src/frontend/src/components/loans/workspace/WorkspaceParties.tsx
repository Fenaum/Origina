import { useState } from "react";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { useLoanDetail } from "@/hooks/useLoanDetail";
import type { LoanSummary } from "@/types/loan";
import type { BorrowerOut } from "@/types/api";

type Props = { loan: LoanSummary };

type PartyRecord = {
  id: string;
  name: string;
  role: string;
  roleKey: string;
  company?: string;
  email?: string;
  phone?: string;
  ext?: string;
  team?: string;
  address?: string;
  notes?: string;
  initials: string;
  isSlot?: boolean; // empty/unassigned role placeholder
};

// ── Default party data ─────────────────────────────────────────────────────────
// TODO: Replace with real assignment data from backend (loan_contacts / loan_parties tables)

const INITIAL_INTERNAL: PartyRecord[] = [
  { id: "ae1",  name: "Marcus Webb",    roleKey: "account_executive",   role: "Account Executive",  email: "m.webb@origina.dev",    phone: "(310) 555-0201", ext: "x201", team: "Wholesale",    initials: "MW" },
  { id: "am1",  name: "Priya Nair",     roleKey: "account_manager",     role: "Account Manager",    email: "p.nair@origina.dev",    phone: "(310) 555-0202", ext: "x202", team: "Wholesale",    initials: "PN" },
  { id: "pr1",  name: "Jordan Ramos",   roleKey: "processor",           role: "Processor",          email: "j.ramos@origina.dev",   phone: "(310) 555-0203", ext: "x203", team: "Operations",   initials: "JR" },
  { id: "uw1",  name: "Dana Kim",       roleKey: "underwriter",         role: "Underwriter",        email: "d.kim@origina.dev",     phone: "(310) 555-0205", ext: "x205", team: "Credit",       initials: "DK" },
  { id: "dc1",  name: "Alex Torres",    roleKey: "disclosure_desk",     role: "Disclosure Desk",    email: "a.torres@origina.dev",  phone: "(310) 555-0207", ext: "x207", team: "Compliance",   initials: "AT" },
  { id: "cl1",  name: "",               roleKey: "closer",              role: "Closer",             initials: "–",                  isSlot: true },
  { id: "fu1",  name: "Simone Liu",     roleKey: "funder",              role: "Funder",             email: "s.liu@origina.dev",     phone: "(310) 555-0210", ext: "x210", team: "Funding",      initials: "SL" },
];

const INITIAL_BROKER: PartyRecord[] = [
  { id: "br1",  name: "Ryan Castillo",       roleKey: "loan_officer",   role: "Loan Officer",   company: "Pacific Brokers LLC", email: "r.castillo@pacbrok.com", phone: "(323) 555-0310", initials: "RC" },
  { id: "br2",  name: "Sarah Mendez",        roleKey: "loan_processor", role: "Loan Processor", company: "Pacific Brokers LLC", email: "s.mendez@pacbrok.com",   phone: "(323) 555-0311", initials: "SM" },
  { id: "br3",  name: "Pacific Brokers LLC", roleKey: "broker_company", role: "Broker Company", company: "Pacific Brokers LLC", email: "loans@pacbrok.com",      phone: "(323) 555-0300", initials: "PB" },
];

const INITIAL_VENDORS: PartyRecord[] = [
  { id: "ap1",  name: "Gregory Hall",         roleKey: "appraiser",      role: "Appraiser",        company: "Hall & Associates",    email: "info@hallapp.com",   phone: "(714) 555-0400", initials: "GH" },
  { id: "es1",  name: "Christine Park",       roleKey: "escrow_officer", role: "Escrow Officer",   company: "SoCal Title & Escrow", email: "c.park@socalte.com", phone: "(949) 555-0450", initials: "CP" },
  { id: "ti1",  name: "First American Title", roleKey: "title_company",  role: "Title Company",    company: "First American",       email: "orders@firstam.com", phone: "(800) 555-0500", initials: "FA" },
  { id: "in1",  name: "HomeGuard Insurance",  roleKey: "insurance",      role: "Insurance Agent",  company: "HomeGuard",            email: "new@homeguard.com",  phone: "(888) 555-0550", initials: "HG" },
  { id: "re1",  name: "",                     roleKey: "realtor",        role: "Realtor",           initials: "–",                   isSlot: true },
  { id: "cpa1", name: "Robert Yuen CPA",      roleKey: "cpa",            role: "CPA",              company: "Yuen Tax & Advisory",  email: "r.yuen@yuencpa.com", phone: "(626) 555-0600", initials: "RY" },
  { id: "att1", name: "",                     roleKey: "attorney",       role: "Attorney",          initials: "–",                   isSlot: true },
];

function borrowerToParty(b: BorrowerOut): PartyRecord {
  const name = [b.first_name, b.last_name].filter(Boolean).join(" ") || "—";
  const initials = [b.first_name?.[0], b.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "B";
  const role = b.type === "primary_borrower" ? "Primary Borrower"
    : b.type === "co_borrower" ? "Co-Borrower"
    : b.type === "guarantor"   ? "Guarantor"
    : "Other";
  return { id: b.id, name, roleKey: b.type, role, email: b.email ?? undefined, phone: b.phone ?? undefined, initials };
}

// ── Main component ─────────────────────────────────────────────────────────────

export function WorkspaceParties({ loan }: Props) {
  const { detail, loading, error } = useLoanDetail(loan.id);
  const [selected, setSelected] = useState<PartyRecord | null>(null);

  // Party state — TODO: replace with backend-driven data
  const [internal, setInternal] = useState<PartyRecord[]>(INITIAL_INTERNAL);
  const [broker,   setBroker]   = useState<PartyRecord[]>(INITIAL_BROKER);
  const [vendors,  setVendors]  = useState<PartyRecord[]>(INITIAL_VENDORS);

  if (loading) return <div className="urla-loading"><LoadingSpinner /></div>;
  if (error)   return <div className="urla-empty"><p className="urla-empty-title">Could not load party data</p><p className="urla-empty-body">{error}</p></div>;

  const borrowerParties = (detail?.borrowers ?? []).map(borrowerToParty);

  function saveParty(updated: PartyRecord) {
    const update = (list: PartyRecord[]) => list.map((p) => p.id === updated.id ? updated : p);
    if (internal.some((p) => p.id === updated.id)) { setInternal(update(internal)); return; }
    if (broker.some((p)   => p.id === updated.id)) { setBroker(update(broker)); return; }
    if (vendors.some((p)  => p.id === updated.id)) { setVendors(update(vendors)); return; }
  }

  return (
    <div className="parties-wrapper">
      <PartyGroup title="Internal Team"         parties={internal}       onSelect={setSelected} />
      <PartyGroup title="Broker Organization"   parties={broker}         onSelect={setSelected} />
      <PartyGroup title="Borrowers"             parties={borrowerParties} onSelect={setSelected} readOnly />
      <PartyGroup title="Third Party Vendors"   parties={vendors}        onSelect={setSelected} />

      {selected && (
        <ContactDrawer
          party={selected}
          onClose={() => setSelected(null)}
          onSave={(updated) => { saveParty(updated); setSelected(updated); }}
          readOnly={borrowerParties.some((p) => p.id === selected.id)}
        />
      )}
    </div>
  );
}

// ── PartyGroup ─────────────────────────────────────────────────────────────────

function PartyGroup({ title, parties, onSelect, readOnly = false }: {
  title: string;
  parties: PartyRecord[];
  onSelect: (p: PartyRecord) => void;
  readOnly?: boolean;
}) {
  if (parties.length === 0) return null;
  return (
    <div className="parties-group">
      <h3 className="parties-group-title">{title}</h3>
      <div className="parties-grid">
        {parties.map((p) =>
          p.isSlot ? (
            <EmptySlotCard key={p.id} party={p} onAssign={() => onSelect(p)} />
          ) : (
            <button key={p.id} type="button" className="party-card" onClick={() => onSelect(p)}>
              <div className="party-card-avatar">{p.initials}</div>
              <div className="party-card-body">
                <span className="party-card-name">{p.name}</span>
                <span className="party-card-role">{p.role}</span>
                {p.company && <span className="party-card-company">{p.company}</span>}
                {p.email   && <span className="party-card-contact">{p.email}</span>}
                {p.phone   && <span className="party-card-contact">{p.phone}</span>}
                {readOnly  && <span className="party-card-readonly-badge">Loan data</span>}
              </div>
            </button>
          )
        )}
      </div>
    </div>
  );
}

function EmptySlotCard({ party, onAssign }: { party: PartyRecord; onAssign: () => void }) {
  return (
    <div className="party-card party-card--slot">
      <div className="party-card-avatar party-card-avatar--empty">+</div>
      <div className="party-card-body">
        <span className="party-card-name party-card-name--unassigned">Unassigned</span>
        <span className="party-card-role">{party.role}</span>
        <button type="button" className="party-assign-btn" onClick={onAssign}>
          Assign
        </button>
      </div>
    </div>
  );
}

// ── ContactDrawer ──────────────────────────────────────────────────────────────

function ContactDrawer({ party, onClose, onSave, readOnly }: {
  party: PartyRecord;
  onClose: () => void;
  onSave: (updated: PartyRecord) => void;
  readOnly: boolean;
}) {
  const [editMode, setEditMode] = useState(party.isSlot ?? false);
  const [draft, setDraft] = useState<PartyRecord>({ ...party });
  const [saveFlash, setSaveFlash] = useState(false);

  const isSlot = party.isSlot;

  function handleSave() {
    const updated: PartyRecord = {
      ...draft,
      isSlot: false,
      initials: [draft.name.split(" ")[0]?.[0], draft.name.split(" ").at(-1)?.[0]]
        .filter(Boolean).join("").toUpperCase() || draft.role.slice(0, 2).toUpperCase(),
    };
    onSave(updated);
    setEditMode(false);
    setSaveFlash(true);
    window.setTimeout(() => setSaveFlash(false), 2500);
  }

  function handleCancel() {
    setDraft({ ...party });
    setEditMode(false);
    if (isSlot) onClose();
  }

  function field(k: keyof PartyRecord) {
    return {
      value: (draft[k] as string | undefined) ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft((prev) => ({ ...prev, [k]: e.target.value })),
    };
  }

  return (
    <>
      <div className="party-drawer-overlay" onClick={onClose} />
      <div className="party-drawer" role="dialog" aria-label={`${editMode ? "Edit" : "Contact details for"} ${party.name || party.role}`}>

        {/* Header */}
        <div className="party-drawer-header">
          <div className="party-drawer-avatar" style={party.isSlot ? { background: "var(--border)" } : undefined}>
            {editMode && draft.name
              ? [draft.name.split(" ")[0]?.[0], draft.name.split(" ").at(-1)?.[0]].filter(Boolean).join("").toUpperCase() || "?"
              : party.initials}
          </div>
          <div className="party-drawer-identity">
            <h3 className="party-drawer-name">{editMode ? (draft.name || "New Contact") : (party.name || "Unassigned")}</h3>
            <p className="party-drawer-role">{party.role}</p>
            {(editMode ? draft.company : party.company) && (
              <p className="party-drawer-company">{editMode ? draft.company : party.company}</p>
            )}
          </div>
          <div className="party-drawer-header-actions">
            {!readOnly && !editMode && (
              <button type="button" className="party-edit-btn" onClick={() => setEditMode(true)}>
                Edit
              </button>
            )}
            <button type="button" className="party-drawer-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {saveFlash && (
          <div className="party-save-flash">Contact saved</div>
        )}

        {/* Body */}
        <div className="party-drawer-body">
          {editMode ? (
            <>
              {/* Edit form */}
              <DrawerSection title={isSlot ? "Assign Contact" : "Edit Contact"}>
                <div className="party-edit-grid">
                  <EditField label="Full Name" id="p-name">
                    <input id="p-name" className="party-edit-input" {...field("name")} placeholder="First Last" />
                  </EditField>
                  <EditField label="Company" id="p-company">
                    <input id="p-company" className="party-edit-input" {...field("company")} />
                  </EditField>
                  <EditField label="Email" id="p-email">
                    <input id="p-email" type="email" className="party-edit-input" {...field("email")} />
                  </EditField>
                  <EditField label="Phone" id="p-phone">
                    <input id="p-phone" type="tel" className="party-edit-input" {...field("phone")} />
                  </EditField>
                  <EditField label="Extension" id="p-ext">
                    <input id="p-ext" className="party-edit-input" {...field("ext")} placeholder="x123" />
                  </EditField>
                  <EditField label="Team / Department" id="p-team">
                    <input id="p-team" className="party-edit-input" {...field("team")} />
                  </EditField>
                  <EditField label="Address" id="p-address">
                    <input id="p-address" className="party-edit-input" {...field("address")} />
                  </EditField>
                </div>
              </DrawerSection>

              <DrawerSection title="Notes">
                <textarea
                  className="party-edit-textarea"
                  rows={3}
                  value={draft.notes ?? ""}
                  onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Internal notes about this contact…"
                />
              </DrawerSection>

              <div className="party-drawer-save-row">
                <button type="button" className="party-save-btn" onClick={handleSave}
                  disabled={!draft.name.trim()}>
                  {isSlot ? "Assign Contact" : "Save Changes"}
                </button>
                <button type="button" className="party-cancel-btn" onClick={handleCancel}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {/* View mode */}
              <DrawerSection title="Contact Information">
                {party.email && (
                  <DrawerRow label="Email">
                    <a href={`mailto:${party.email}`} className="party-drawer-link">{party.email}</a>
                  </DrawerRow>
                )}
                {party.phone && <DrawerRow label="Phone">{party.phone}</DrawerRow>}
                {party.ext   && <DrawerRow label="Extension">{party.ext}</DrawerRow>}
                {party.address && <DrawerRow label="Address">{party.address}</DrawerRow>}
                {party.team  && <DrawerRow label="Team">{party.team}</DrawerRow>}
                {!party.email && !party.phone && (
                  <p className="party-drawer-placeholder">No contact details on file.</p>
                )}
              </DrawerSection>

              {party.notes && (
                <DrawerSection title="Notes">
                  <p className="party-drawer-notes">{party.notes}</p>
                </DrawerSection>
              )}

              <DrawerSection title="Communication History">
                <p className="party-drawer-placeholder">Communication history will be available in a future release.</p>
              </DrawerSection>

              <DrawerSection title="Assigned Loans">
                <p className="party-drawer-placeholder">Assigned loans will be available in a future release.</p>
              </DrawerSection>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Drawer helpers ─────────────────────────────────────────────────────────────

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="party-drawer-section">
      <p className="party-drawer-section-title">{title}</p>
      {children}
    </div>
  );
}

function DrawerRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="party-drawer-row">
      <span className="party-drawer-label">{label}</span>
      <span className="party-drawer-value">{children}</span>
    </div>
  );
}

function EditField({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="party-edit-field">
      <label htmlFor={id} className="party-edit-label">{label}</label>
      {children}
    </div>
  );
}
