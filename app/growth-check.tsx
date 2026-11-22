'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { chatLink, email, priority, questions, whatsappDisplay } from './brand-data';
import { Mark } from './mark';

const storageKey = 'vyral-check';
const AnswersContext = createContext<{
  answers: boolean[];
  update: (next: boolean[]) => void;
  name: string;
  setName: (name: string) => void;
}>({
  answers: [],
  update: () => {},
  name: '',
  setName: () => {},
});

export function GrowthCheckProvider({children}: {children: ReactNode}) {
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [name, setName] = useState('');

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      if (Array.isArray(saved) && saved.length === questions.length && saved.every(value => typeof value === 'boolean')) {
        setAnswers(saved);
      }
    } catch { /* The check works if storage is unavailable. */ }
  }, []);

  function update(next: boolean[]) {
    try {
      if (next.length === questions.length) localStorage.setItem(storageKey, JSON.stringify(next));
      else localStorage.removeItem(storageKey);
    } catch { /* Keep the current session usable. */ }
    setAnswers(next);
  }

  return (
    <AnswersContext.Provider value={{ answers, update, name, setName }}>
      {children}
    </AnswersContext.Provider>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

export function AuditLink() {
  const { answers, name, setName } = useContext(AnswersContext);
  const business = name.trim();
  const gaps = priority.filter(index => answers[index] === false);
  const complete = answers.length === questions.length;
  const summary = complete
    ? ` Growth check: ${answers.filter(Boolean).length}/${questions.length} in place.${gaps.length ? ` Gaps: ${gaps.map(index => questions[index].label).join(', ')}.` : ''}`
    : '';
  const href = chatLink(`Hi Vyral, I'd like a free audit${business ? ` for ${business}` : ''}.${summary}`);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const number = useRef<HTMLSpanElement>(null);
  const done = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sent) done.current?.focus({ preventScroll: true });
  }, [sent]);

  function copyNumber() {
    const select = () => {
      if (number.current) window.getSelection()?.selectAllChildren(number.current);
    };
    try {
      navigator.clipboard.writeText(whatsappDisplay).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }, select);
    } catch {
      select();
    }
  }

  if (sent) {
    return (
      <div className="audit-link audit-done" ref={done} tabIndex={-1} role="status">
        <p className="audit-done-title">Did WhatsApp open?</p>
        <p>Send the message there and we’ll reply with {business ? `the free audit for ${business}` : 'your free audit'}. If it didn’t open, message us on this number or send an email.</p>
        <p className="audit-done-number">
          <span ref={number}>{whatsappDisplay}</span>
          <button type="button" className="text-button" onClick={copyNumber}>{copied ? 'Copied' : 'Copy number'}</button>
        </p>
        <p><a className="audit-done-email" href={`mailto:${email}`}>{email}</a></p>
        <p className="audit-done-actions">
          <a className="text-button" href={href} target="_blank" rel="noopener noreferrer">Open WhatsApp again</a>
          <button type="button" className="text-button" onClick={() => setSent(false)}>Edit message</button>
        </p>
      </div>
    );
  }

  return (
    <div className="audit-link">
      <label>
        <span className="input-label">Business name <span>(optional)</span></span>
        <input
          autoComplete="organization"
          maxLength={60}
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="Your business name"
        />
      </label>
      <a className="button button-primary" target="_blank" rel="noopener noreferrer" href={href} onClick={() => window.setTimeout(() => setSent(true), 60)}>
        get my free audit <span className="button-icon" aria-hidden="true"><WhatsAppIcon /></span>
      </a>
      <p className="audit-note">{complete ? 'Your draft includes the growth check results.' : 'Opens WhatsApp with a draft ready to send.'}</p>
    </div>
  );
}

export default function GrowthCheck() {
  const {answers, update} = useContext(AnswersContext);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusAfterChange = useRef(false);
  const step = answers.length;
  const complete = step === questions.length;
  const question = questions[step];
  const gaps = priority.filter(index => answers[index] === false);

  useEffect(() => {
    if (focusAfterChange.current) {
      heading.current?.focus();
      focusAfterChange.current = false;
    }
  }, [step]);

  function moveTo(next: boolean[]) {
    focusAfterChange.current = true;
    update(next);
  }

  return <div className="check-card">
    {step > 0 && <span className="check-sweep" key={step} aria-hidden="true" />}
    <div className="check-meta">
      <p className="eyebrow" aria-live="polite">{complete ? 'Your results' : `Question ${step + 1} of ${questions.length}`}</p>
      {step > 0 && <button type="button" className="text-button" onClick={() => moveTo(answers.slice(0, -1))}>← Back</button>}
    </div>
    <div className="progress" aria-hidden="true">
      {questions.map((item, index) => (
        <span key={item.key} data-current={index === step} data-answer={answers[index] === undefined ? undefined : answers[index] ? 'yes' : 'no'}><Mark /></span>
      ))}
    </div>
    {question ? <div className="check-content" key={question.key}>
      <h3 ref={heading} tabIndex={-1}>{question.question}</h3>
      <p>{question.hint}</p>
      <div className="answer-buttons">
        <button className="button button-lime" type="button" onClick={() => moveTo([...answers, true])}>yes</button>
        <button className="button button-outline" type="button" onClick={() => moveTo([...answers, false])}>not yet</button>
      </div>
    </div> : <div className="check-content results">
      <h3 ref={heading} tabIndex={-1}>{answers.filter(Boolean).length} out of {questions.length} in place.</h3>
      {gaps.length > 0 ? <>
        <p>Here’s what we’d work on first, in order.</p>
        <ol>{gaps.map(index => <li key={questions[index].key}><strong>{questions[index].label}</strong><p>{questions[index].reason} {questions[index].action}</p></li>)}</ol>
      </> : <p>You’ve got the basics covered. Ask us to find the next opportunity for your business.</p>}
      <AuditLink />
      <button className="text-button" type="button" onClick={() => moveTo([])}>Start over</button>
    </div>}
  </div>;
}
