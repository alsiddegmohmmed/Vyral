'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { chatLink, priority, questions } from './brand-data';
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

export function AuditLink() {
  const { answers, name, setName } = useContext(AnswersContext);
  const business = name.trim();
  const gaps = priority.filter(index => answers[index] === false);
  const complete = answers.length === questions.length;
  const summary = complete
    ? ` Growth check: ${answers.filter(Boolean).length}/${questions.length} in place.${gaps.length ? ` Gaps: ${gaps.map(index => questions[index].label).join(', ')}.` : ''}`
    : '';
  const href = chatLink(`Hi Vyral, I'd like a free audit${business ? ` for ${business}` : ''}.${summary}`);
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
      <a className="button button-primary" target="_blank" rel="noopener noreferrer" href={href}>
        Get a free audit on WhatsApp <span className="button-icon" aria-hidden="true">↗</span>
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
        <span key={item.key} data-done={index < step} data-current={index === step}><Mark /></span>
      ))}
    </div>
    {question ? <div className="check-content" key={question.key}>
      <h3 ref={heading} tabIndex={-1}>{question.question}</h3>
      <p>{question.hint}</p>
      <div className="answer-buttons">
        <button className="button button-lime" type="button" onClick={() => moveTo([...answers, true])}>Yes</button>
        <button className="button button-outline" type="button" onClick={() => moveTo([...answers, false])}>Not yet</button>
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
