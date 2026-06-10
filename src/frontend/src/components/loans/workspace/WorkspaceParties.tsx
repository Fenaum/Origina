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
  company?: string;
  email?: string;
  phone?: string;
  ext?: string;
  team?: string;
  initials: string;
  notes?: string;
};

const INTERNAL: PartyRecord[] = [
  { id: "ae1",  name: "Marcus Webb",    role: "Account Executive",    email: "m.webb@origina.dev",    phone: "(310) 555-0201", ext: "x201", team: "Wholesale",     initials: "MW" },
  { id: "am1",  name: "Priya Nair",     role: "Account Manager",      email: "p.nair@origina.dev",    phone: "(310) 555-0202", ext: "x202", team: "Wholesale",     initials: "PN" },
  { id: "pr1",  name: "Jordan Ramos",   role: "Processor",             email: "j.ramos@origina.dev",   phone: "(310) 555-0203", ext: "x203", team: "Operations",    initials: "JR" },
  { id: "uw1",  name: "Dana Kim",       role: "Underwriter",           email: "d.kim@origina.dev",     phone: "(310) 555-0205", ext: "x205", team: "Credit",        initials: "DK" },
  { id: "dc1",  name: "Alex Torres",    role: "Disclosure Clerk",      email: "a.torres@origina.dev",  phone: "(310) 555-0207", ext: "x207", team: "Compliance",    initials: "AT" },
  { id: "fu1",  name: "Simone Liu",     role: "Funder",                email: "s.liu@origina.dev",     phone: "(310) 555-0210", ext: "x210", team: "Funding",       initials: "SL" },
  { id: "pc1",  name: "Devon Harris",   role: "Post Closing",          email: "d.harris@origina.dev",  phone: "(310) 555-0215", ext: "x215", team: "Post Closing",  initials: "DH" },
];

const BROKER: PartyRecord[] = [
  { id: "br1",  name: "Ryan Castillo",  role: "Loan Officer",   company: "Pacific Brokers LLC", email: "r.castillo@pacbrok.com", phone: "(323) 555-0310", initials: "RC" },
  { id: "br2",  name: "Sarah Mendez",   role: "Loan Processor", company: "Pacific Brokers LLC", email: "s.mendez@pacbrok.com",   phone: "(323) 555-0311", initials: "SM" },
  { id: "br3",  name: "Pacific Brokers LLC", role: "Broker Company", company: "Pacific Brokers LLC", email: "loans@pacbrok.com", phone: "(323) 555-0300", initials: "PB" },
];

const VENDORS: PartyRecord[] = [
  { id: "ap1",  name: "Gregory Hall",       role: "Appraiser",        company: "Hall & Associates",       email: "info@hallapp.com",    phone: "(714) 555-0400", initials: "GH" },
  { id: "es1",  name: "Christine Park",     role: "Escrow Officer",   company: "SoCal Title & Escrow",    email: "c.park@socalte.com",  phone: "(949) 555-0450", initials: "CP" },
  { id: "ti1",  name: "First American Title", role: "Title Company",  company: "First American",          email: "orders@firstam.com",  phone: "(800) 555-0500", initials: "FA" },
  { id: "in1",  name: "HomeGuard Insurance", role: "Insurance Agent", company: "HomeGuard",               email: "new@homeguard.com",   phone: "(888) 555-0550", initials: "HG" },
  { id: "cpa1", name: "Robert Yuen CPA",    role: "CPA",              company: "Yuen Tax & Advisory",     email: "r.yuen@yuencpa.com",  phone: "(626) 555-0600", initials: "RY" },
];

function borrowerToParty(b: BorrowerOut): PartyRecord {
  const name = [b.first_name, b.last_name].filter(Boolean).join(" ") || "—";
  const initials = [b.first_name?.[0], b.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "B";
  const roleLabel = b.type === "primary_borrower" ? "Primary Borrower"
    : b.type === "co_borrower" ? "Co-Borrower"
    : b.type === "guarantor"   ? "Guarantor"
    : "Other";
  return { id: b.id, name, role: roleLabel, email: b.email ?? undefined, phone: b.phone ?? undefined, initials };
}

export function WorkspaceParties({ loan }: Props) {
  const { detail, loading, error } = useLoanDetail(loan.id);
  const [selected, setSelected] = useState<PartyRecord | null>(null);

  if (loading) return <div className="urla-loading"><LoadingSpinner /></div>;
  if (error)   return <div className="urla-empty"><p className="urla-empty-title">Could not load party data</p><p className="urla-empty-body">{error}</p></div>;

  const borrowerParties = (detail?.borrowers ?? []).map(borrowerToParty);

  return (
    <div className="parties-wrapper">

      <PartyGroup title="Internal Team" parties={INTERNAL} onSelect={setSelected} />
      <PartyGroup title="Broker Organization" parties={BROKER}   onSelect={setSelected} />
      <PartyGroup title="Borrowers"          parties={borrowerParties} onSelect={setSelected} />
      <PartyGroup title="Third Party Vendors" parties={VENDORS}  onSelect={setSelected} />

      {selected && (
        <ContactDrawer party={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function PartyGroup({ title, parties, onSelect }: {
  title: string;
  parties: PartyRecord[];
  onSelect: (p: PartyRecord) => void;
}) {
  if (parties.length === 0) return null;
  return (
    <div className="parties-group">
      <h3 className="parties-group-title">{title}</h3>
      <div className="parties-grid">
        {parties.map((p) => (
          <button
            key={p.id}
            type="button"
            className="party-card"
            onClick={() => onSelect(p)}
          >
            <div className="party-card-avatar">{p.initials}</div>
            <div className="party-card-body">
              <span className="party-card-name">{p.name}</span>
              <span className="party-card-role">{p.role}</span>
              {p.company && <span className="party-card-company">{p.company}</span>}
              {p.email   && <span className="party-card-contact">{p.email}</span>}
              {p.phone   && <span className="party-card-contact">{p.phone}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ContactDrawer({ party, onClose }: { party: PartyRecord; onClose: () => void }) {
  return (
    <>
      <div className="party-drawer-overlay" onClick={onClose} />
      <div className="party-drawer" role="dialog" aria-label={`Contact details for ${party.name}`}>
        <div className="party-drawer-header">
          <div className="party-drawer-avatar">{party.initials}</div>
          <div>
            <h3 className="party-drawer-name">{party.name}</h3>
            <p className="party-drawer-role">{party.role}</p>
            {party.company && <p className="party-drawer-company">{party.company}</p>}
          </div>
          <button type="button" className="party-drawer-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="party-drawer-body">
          <DrawerSection title="Contact Information">
            {party.email && (
              <DrawerRow label="Email">
                <a href={`mailto:${party.email}`} className="party-drawer-link">{party.email}</a>
              </DrawerRow>
            )}
            {party.phone && <DrawerRow label="Phone">{party.phone}</DrawerRow>}
            {party.ext   && <DrawerRow label="Extension">{party.ext}</DrawerRow>}
            {party.team  && <DrawerRow label="Team">{party.team}</DrawerRow>}
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
        </div>
      </div>
    </>
  );
}

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
