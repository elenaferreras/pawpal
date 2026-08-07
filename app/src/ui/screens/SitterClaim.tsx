import { useState } from "react";
import { claimInvite, formatCode, type SitterState } from "../lib/sitter";

interface SitterClaimProps {
  initialCode?: string;
  onClose: () => void;
  onClaimed: (state: SitterState) => void;
}

/**
 * Sitter code-entry screen. Reached from "I'm dog sitting today" on the welcome
 * screen, or auto-prefilled from a `?sit=CODE` invite link.
 */
export function SitterClaim({
  initialCode,
  onClose,
  onClaimed,
}: SitterClaimProps): React.ReactElement {
  const [code, setCode] = useState(initialCode ? formatCode(initialCode) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clean = code.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
  const canSubmit = clean.length >= 6 && !busy;

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const state = await claimInvite(clean);
      onClaimed(state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="obw obw--plain">
      <div className="obw-ctas obw-ctas--top">
        <div className="obw-heading">
          <h1 className="obw-title">Dog sitting?</h1>
          <p className="obw-sub">Enter the invite code the owner gave you.</p>
        </div>

        <div className="obw-buttons">
          <input
            className="sitclaim-input"
            value={code}
            onChange={(e) => {
              setCode(formatCode(e.target.value.replace(/[^0-9a-zA-Z]/g, "")));
              setError(null);
            }}
            placeholder="XXXX-XXXX"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={9}
            aria-label="Invite code"
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
          {error && <p className="sitclaim-error">{error}</p>}

          <button
            type="button"
            className="obw-btn obw-btn--primary"
            onClick={() => void submit()}
            disabled={!canSubmit}
            style={{ opacity: canSubmit ? 1 : 0.5 }}
          >
            {busy ? "Joining\u2026" : "Start sitting"}
          </button>
          <button type="button" className="obw-btn obw-btn--ghost" onClick={onClose}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
