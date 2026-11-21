import React, { useRef, useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import './PasswordInput.css';

export default function PasswordInput({ label = 'password', className = '', id, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  const inputRef = useRef(null);

  const toggleVisibility = () => {
    const input = inputRef.current;
    if (!input) return;

    const selectionStart = input.selectionStart;
    const selectionEnd = input.selectionEnd;
    const nextType = input.type === 'password' ? 'text' : 'password';

    // Update the native input immediately; React state keeps the icon and ARIA label aligned.
    input.type = nextType;
    setVisible(nextType === 'text');
    input.focus({ preventScroll: true });
    if (selectionStart !== null && selectionEnd !== null) {
      input.setSelectionRange(selectionStart, selectionEnd);
    }
  };

  return (
    <span className="password-input-wrap">
      <input
        {...inputProps}
        ref={inputRef}
        id={id}
        type={visible ? 'text' : 'password'}
        className={`password-input-control ${className}`.trim()}
      />
      <button
        type="button"
        className="password-visibility-toggle"
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggleVisibility}
        aria-label={`${visible ? 'Hide' : 'Show'} ${label}`}
        aria-pressed={visible}
        aria-controls={id}
        title={`${visible ? 'Hide' : 'Show'} ${label}`}
      >
        {visible ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
      </button>
    </span>
  );
}
