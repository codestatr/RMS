import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import './PasswordInput.css';

export default function PasswordInput({ label = 'password', className = '', id, ...inputProps }) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="password-input-wrap">
      <input
        {...inputProps}
        id={id}
        type={visible ? 'text' : 'password'}
        className={`password-input-control ${className}`.trim()}
      />
      <button
        type="button"
        className="password-visibility-toggle"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((isVisible) => !isVisible)}
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
