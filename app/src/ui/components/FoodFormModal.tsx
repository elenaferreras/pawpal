import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { nowTime } from "../lib/date";
import type { Meal } from "../types";

interface FoodFormModalProps {
  open: boolean;
  onClose: () => void;
}

const TYPES = ["Dry kibble", "Wet food", "Raw", "Treats", "Other"];

export function FoodFormModal({ open, onClose }: FoodFormModalProps): React.ReactElement {
  const { update } = useDb();
  const toast = useToast();
  const [time, setTime] = useState("");
  const [type, setType] = useState(TYPES[0]);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setTime(nowTime());
      setType(TYPES[0]);
      setAmount("");
      setNotes("");
    }
  }, [open]);

  const save = (): void => {
    if (!amount) {
      toast("Enter an amount");
      return;
    }
    const meal: Meal = {
      date: new Date().toISOString().split("T")[0],
      time,
      type,
      amount: parseInt(amount) || 0,
      notes,
      created: new Date().toISOString(),
    };
    update((d) => {
      d.meals.push(meal);
    });
    toast("Meal logged! 🍖");
    onClose();
  };

  return (
    <Modal open={open} title="Log a meal" onClose={onClose}>
      <div className="form-row">
        <div>
          <span className="form-label">Time</span>
          <input type="time" className="form-input" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <span className="form-label">Amount (g)</span>
          <input type="number" className="form-input" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <span className="form-label">Type</span>
        <select className="form-input" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <span className="form-label">Notes</span>
        <textarea className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <button className="btn btn-primary btn-full" onClick={save}>
        Save meal
      </button>
    </Modal>
  );
}
