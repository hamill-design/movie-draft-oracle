
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PickConfirmationProps {
  currentPlayerName: string;
  selectedMovie: any;
  selectedCategory: string;
  onConfirm: () => void;
}

const PickConfirmation = ({
  currentPlayerName,
  selectedMovie,
  selectedCategory,
  onConfirm
}: PickConfirmationProps) => {
  if (!selectedMovie || !selectedCategory) return null;

  return (
    <div 
      style={{
        width: '100%',
        height: '100%',
        padding: '24px',
        background: '#0E0E0F',
        boxShadow: '0px 0px 6px #3B0394',
        borderRadius: '8px',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        gap: '24px',
        display: 'inline-flex'
      }}
    >
      <div 
        style={{
          alignSelf: 'stretch',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'center',
          gap: '16px',
          display: 'flex'
        }}
      >
        <div 
          style={{
            alignSelf: 'stretch',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: '4px',
            display: 'flex'
          }}
        >
          <div 
            style={{
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'center',
              display: 'flex'
            }}
          >
            <div 
              style={{
                alignSelf: 'stretch',
                textAlign: 'center',
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                color: '#FCFFFF',
                fontSize: '16px',
                fontFamily: 'Brockmann',
                fontWeight: 400,
                lineHeight: '24px',
                letterSpacing: '0.32px',
                flexWrap: 'wrap',
                gap: '4px'
              }}
            >
              <span style={{ fontWeight: 600 }}>{currentPlayerName}</span>
              <span>is drafting:</span>
            </div>
          </div>
          <div 
            style={{
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'center',
              display: 'flex'
            }}
          >
            <div 
              style={{
                alignSelf: 'stretch',
                textAlign: 'center',
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column',
                color: '#907AFF',
                fontSize: '20px',
                fontFamily: 'Brockmann',
                fontWeight: 700,
                lineHeight: '28px'
              }}
            >
              {selectedMovie.title}
            </div>
          </div>
          <div 
            style={{
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'center',
              display: 'flex'
            }}
          >
            <div 
              style={{
                alignSelf: 'stretch',
                textAlign: 'center',
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                fontSize: '16px',
                fontFamily: 'Brockmann',
                fontWeight: 400,
                lineHeight: '24px',
                flexWrap: 'wrap',
                gap: '4px'
              }}
            >
              <span style={{ color: '#BDC3C2' }}>for category:</span>
              <span style={{ color: '#907AFF' }}>{selectedCategory}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onConfirm}
          style={{
            paddingLeft: '24px',
            paddingRight: '24px',
            paddingTop: '12px',
            paddingBottom: '12px',
            background: '#FFD60A',
            borderRadius: '2px',
            justifyContent: 'center',
            alignItems: 'center',
            display: 'inline-flex',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <div 
            style={{
              textAlign: 'center',
              justifyContent: 'center',
              display: 'flex',
              flexDirection: 'column',
              color: '#2B2D2D',
              fontSize: '16px',
              fontFamily: 'Brockmann',
              fontWeight: 600,
              lineHeight: '24px',
              letterSpacing: '0.32px'
            }}
          >
            Confirm Pick
          </div>
        </button>
      </div>
    </div>
  );
};

export default PickConfirmation;
