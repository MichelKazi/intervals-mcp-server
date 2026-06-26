import { useState } from 'react';
import { createCustomWorkout } from '../../lib/api';

interface Step {
  power: number;
  durationMins: number;
}

interface CustomWorkoutFormProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function CustomWorkoutForm({ onClose, onCreated }: CustomWorkoutFormProps) {
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<Step[]>([{ power: 100, durationMins: 10 }]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function addStep() {
    setSteps(s => [...s, { power: 100, durationMins: 5 }]);
  }

  function removeStep(idx: number) {
    setSteps(s => s.filter((_, i) => i !== idx));
  }

  function updateStep(idx: number, field: keyof Step, value: number) {
    setSteps(s => s.map((step, i) => i === idx ? { ...step, [field]: value } : step));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || steps.length === 0) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      await createCustomWorkout({
        name: name.trim(),
        workout_type: 'Ride',
        steps: steps.map(s => ({
          duration: s.durationMins * 60,
          power: { units: 'percent', value: s.power },
        })),
      });
      setStatus('success');
      setTimeout(() => {
        onCreated();
      }, 1200);
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Failed to create workout');
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Build custom workout"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }}
      />

      {/* Sheet */}
      <form
        onSubmit={handleSubmit}
        style={{
          position: 'relative',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          padding: 'var(--sp-4)',
          paddingBottom: 'calc(var(--sp-8) + env(safe-area-inset-bottom))',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-3)',
        }}
      >
        {/* Handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto var(--sp-4)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Build custom workout</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 20, minWidth: 44, minHeight: 44 }}
          >
            ✕
          </button>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <label
            htmlFor="custom-name"
            style={{ fontSize: 12, color: 'var(--text-dim)', display: 'block', marginBottom: 'var(--sp-1)' }}
          >
            Workout name
          </label>
          <input
            id="custom-name"
            type="text"
            placeholder="e.g. Tuesday Threshold"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            style={{
              width: '100%',
              minHeight: 44,
              padding: '0 var(--sp-3)',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: 15,
              fontFamily: 'var(--font)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Steps */}
        <div style={{ marginBottom: 'var(--sp-3)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 'var(--sp-2)' }}>Steps</div>
          {steps.map((step, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: 'var(--sp-2)',
                alignItems: 'center',
                marginBottom: 'var(--sp-2)',
                padding: 'var(--sp-2) var(--sp-3)',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius)',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 20 }}>#{idx + 1}</span>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>Power %FTP</label>
                <input
                  type="number"
                  min={30}
                  max={200}
                  value={step.power}
                  onChange={e => updateStep(idx, 'power', Number(e.target.value))}
                  style={{
                    minHeight: 36,
                    padding: '0 var(--sp-2)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 14,
                    fontFamily: 'var(--font)',
                    width: '100%',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>Duration (min)</label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={step.durationMins}
                  onChange={e => updateStep(idx, 'durationMins', Number(e.target.value))}
                  style={{
                    minHeight: 36,
                    padding: '0 var(--sp-2)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 14,
                    fontFamily: 'var(--font)',
                    width: '100%',
                  }}
                />
              </div>
              {steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStep(idx)}
                  aria-label={`Remove step ${idx + 1}`}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--z5)',
                    cursor: 'pointer',
                    fontSize: 18,
                    minWidth: 44,
                    minHeight: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addStep}
            style={{
              minHeight: 44,
              padding: '0 var(--sp-3)',
              background: 'var(--surface-2)',
              color: 'var(--accent)',
              border: `1px dashed var(--accent)`,
              borderRadius: 'var(--radius)',
              fontSize: 13,
              fontFamily: 'var(--font)',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            + Add step
          </button>
        </div>

        {status === 'error' && (
          <p style={{ color: 'var(--z5)', fontSize: 13, marginBottom: 'var(--sp-3)' }}>{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={!name.trim() || status === 'loading' || status === 'success'}
          style={{
            width: '100%',
            minHeight: 44,
            background: 'var(--accent)',
            color: '#000',
            border: 'none',
            borderRadius: 'var(--radius)',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: 'var(--font)',
            cursor: name.trim() ? 'pointer' : 'not-allowed',
            opacity: name.trim() ? 1 : 0.5,
          }}
        >
          {status === 'loading' ? 'Creating…' : status === 'success' ? 'Created!' : 'Create workout'}
        </button>
      </form>
    </div>
  );
}
