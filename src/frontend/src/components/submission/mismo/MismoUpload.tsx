import { useRef, useState } from "react";
import { useRouter } from "next/router";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { parseMismoFile } from "@/services/mismoService";
import {
  createBorrowerForLoan,
  patchLoanHeader,
  upsertLoanFinancials,
} from "@/services/submissionService";
import { useLoanSubmissionStore } from "@/state/submissionStore";
import type { MismoParsed } from "@/types/submission";

const parseSteps = [
  "Reading borrower data",
  "Reading property",
  "Reading income",
  "Mapping Origina fields",
];

export function MismoUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [parsed, setParsed] = useState<MismoParsed | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { startNewDraft, hydrateFromMismo, saveDraft } = useLoanSubmissionStore();

  async function handleFile(file: File) {
    if (!/\.(xml|fnm|mismo)$/i.test(file.name)) {
      setError("Upload a .xml, .fnm, or .mismo file.");
      return;
    }

    setError(null);
    setIsParsing(true);
    const nextParsed = await parseMismoFile(file);
    setParsed(nextParsed);
    setIsParsing(false);
  }

  async function applyImport() {
    if (!parsed) return;
    const loanId = await startNewDraft("mismo");
    hydrateFromMismo({
      setup: { ...useLoanSubmissionStore.getState().draft.setup, ...parsed.loan },
      property: { ...useLoanSubmissionStore.getState().draft.property, ...parsed.property },
      borrowers: parsed.borrowers.length
        ? [
            {
              ...useLoanSubmissionStore.getState().draft.borrowers[0],
              ...parsed.borrowers[0],
            },
          ]
        : useLoanSubmissionStore.getState().draft.borrowers,
      income: parsed.income as never,
    });

    // Persist parsed data to the backend so the pipeline shows real values.
    await Promise.all([
      // Loan header: program and purpose
      patchLoanHeader(loanId, {
        loan_program: parsed.loan.product ?? null,
        purpose: parsed.loan.purpose ?? null,
      }),
      // Financials: loan amount and estimated property value
      ...(parsed.loan.loanAmount != null || parsed.property.estimatedValue != null
        ? [
            upsertLoanFinancials(loanId, {
              loan_amount: parsed.loan.loanAmount ?? null,
              appraised_value: parsed.property.estimatedValue ?? null,
            }),
          ]
        : []),
      // Borrowers: create a DB row for each parsed borrower (SSN never sent)
      ...parsed.borrowers.map((b, i) =>
        createBorrowerForLoan(loanId, {
          type: i === 0 ? "primary_borrower" : "co_borrower",
          first_name: b.firstName ?? null,
          last_name: b.lastName ?? null,
          email: b.email ?? null,
          phone: b.phone ?? null,
          dob: b.dob ?? null,
        }),
      ),
    ]);

    await saveDraft();
    void router.push(`/loans/${loanId}/edit/setup`);
  }

  return (
    <section className="mismo-flow fade-slide-in">
      <div
        className="mismo-drop-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
      >
        <h2>Import 1003 / MISMO XML</h2>
        <p>Upload a file from Encompass, Calyx, BytePro, or another LOS.</p>
        <button className="primary-button" type="button" onClick={() => inputRef.current?.click()}>
          Upload File
        </button>
        <input
          hidden
          ref={inputRef}
          type="file"
          accept=".xml,.fnm,.mismo"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        {error ? <p className="danger-text">{error}</p> : null}
      </div>
      {isParsing ? (
        <div className="panel parse-panel">
          <div className="panel-heading">
            <h3>Parsing file</h3>
            <LoadingSpinner label="Parsing" />
          </div>
          {parseSteps.map((step, index) => (
            <div className="status-row" key={step}>
              <span>{step}</span>
              <p>{index < 2 ? "Complete" : "Reading..."}</p>
            </div>
          ))}
        </div>
      ) : null}
      {parsed ? (
        <div className="panel mapping-panel">
          <div className="panel-heading">
            <h3>Mapping Preview</h3>
            <span>{Math.round(parsed.confidence * 100)}% confidence</span>
          </div>
          <div className="mapping-grid">
            <MappingColumn title="From your file" rows={[
              ["LoanAmount", String(parsed.loan.loanAmount ?? "")],
              ["BorrowerLastName", String(parsed.borrowers[0]?.lastName ?? "")],
              ["SubjectPropertyCity", String(parsed.property.city ?? "")],
              ["IncomeType", String(parsed.income.type ?? "")],
            ]} />
            <MappingColumn title="Mapped to Origina" rows={[
              ["Loan Amount", String(parsed.loan.loanAmount ?? "")],
              ["Last Name", String(parsed.borrowers[0]?.lastName ?? "")],
              ["Property City", String(parsed.property.city ?? "")],
              ["Product Type", String(parsed.loan.product ?? "")],
            ]} />
          </div>
          <div className="mismo-actions">
            <button className="primary-button" type="button" onClick={() => void applyImport()}>
              Accept All
            </button>
            <button className="ghost-button" type="button">Review Conflicts</button>
            <button className="ghost-button" type="button" onClick={() => void applyImport()}>
              Continue with Partial Import
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MappingColumn({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div>
      <h3>{title}</h3>
      {rows.map(([label, value]) => (
        <div className="mapping-row" key={label}>
          <span>{label}</span>
          <strong>{value || "—"}</strong>
        </div>
      ))}
    </div>
  );
}
