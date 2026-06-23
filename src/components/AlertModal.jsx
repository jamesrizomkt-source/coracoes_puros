import React from 'react';

export default function AlertModal({ isOpen, message, onClose }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 47, 111, 0.4)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--white)',
        borderRadius: 'var(--radius)',
        padding: '32px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: 'var(--shadow)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div style={{
          color: 'var(--ink)',
          fontSize: '18px',
          fontWeight: '500',
          lineHeight: '1.5'
        }}>
          {message}
        </div>
        <button 
          onClick={onClose}
          style={{
            backgroundColor: 'var(--blue)',
            color: 'var(--white)',
            border: 'none',
            borderRadius: 'var(--radius)',
            padding: '14px 24px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            alignSelf: 'center',
            width: '100%',
            maxWidth: '200px'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--blue-dark)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--blue)'}
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
