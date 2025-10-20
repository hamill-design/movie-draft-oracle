import React from 'react';
import { DraftPick } from '@/hooks/useDrafts';

interface CategoryScore {
  categoryName: string;
  picks: DraftPick[];
  averageScore: number;
  topPick: DraftPick;
  playerCount: number;
}

interface CategoryLeaderboardProps {
  categoryScores: CategoryScore[];
  selectedCategory: string;
  onSelectCategory: (categoryName: string) => void;
  hoveredCategory: string;
  onHoverCategory: (categoryName: string) => void;
}

const CategoryLeaderboard: React.FC<CategoryLeaderboardProps> = ({
  categoryScores,
  selectedCategory,
  onSelectCategory,
  hoveredCategory,
  onHoverCategory
}) => {
  const getRankingBadgeStyle = (index: number) => {
    const rank = index + 1;
    
    if (rank === 1) {
      return {
        background: 'linear-gradient(to bottom right, #FFF2B2, #F0AA11)',
        padding: '2px',
        color: 'var(--Greyscale-(Blue)-800, #2B2D2D)'
      };
    } else if (rank === 2) {
      return {
        background: 'linear-gradient(to bottom right, #E5E5E5, #666666)',
        padding: '2px',
        color: 'var(--Greyscale-(Blue)-800, #2B2D2D)'
      };
    } else if (rank === 3) {
      return {
        background: 'linear-gradient(to bottom right, #FFAE78, #95430C)',
        padding: '2px',
        color: 'var(--Greyscale-(Blue)-50, #F8F8F8)'
      };
    } else {
      return {
        background: 'var(--Greyscale-800, #4D4D4D)',
        color: 'var(--UI-Primary, white)'
      };
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      padding: '24px',
      background: 'hsl(var(--greyscale-blue-100))',
      boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.25)',
      borderRadius: '4px',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      gap: '24px',
      display: 'inline-flex'
    }}>
      <div style={{
        alignSelf: 'stretch',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px',
        display: 'flex'
      }}>
        <div style={{
          justifyContent: 'center',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--Text-Primary, #2B2D2D)',
          fontSize: '24px',
          fontFamily: 'Brockmann',
          fontWeight: '700',
          lineHeight: '32px',
          letterSpacing: '0.96px',
          wordWrap: 'break-word'
        }}>
          CATEGORY RANKINGS
        </div>
      </div>
      <div style={{
        alignSelf: 'stretch',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        gap: '16px',
        display: 'flex'
      }}>
        {categoryScores.map((category, index) => {
          const badgeStyle = getRankingBadgeStyle(index);
          return (
            <div
              key={category.categoryName}
              onClick={() => onSelectCategory(category.categoryName)}
              onMouseEnter={() => onHoverCategory(category.categoryName)}
              onMouseLeave={() => onHoverCategory('')}
              style={{
                alignSelf: 'stretch',
                paddingTop: '16px',
                paddingBottom: '16px',
                paddingLeft: '16px',
                paddingRight: '24px',
                background: selectedCategory === category.categoryName 
                  ? 'var(--Purple-100, #EDEBFF)' 
                  : hoveredCategory === category.categoryName 
                    ? 'var(--Purple-50, #F8F7FF)' 
                    : 'var(--UI-Primary, white)',
                borderRadius: '8px',
                outline: selectedCategory === category.categoryName 
                  ? '1px var(--Purple-200, #BCB2FF) solid' 
                  : '1px var(--Purple-100, #EDEBFF) solid',
                outlineOffset: '-1px',
                justifyContent: 'flex-start',
                alignItems: 'center',
                gap: '16px',
                display: 'inline-flex',
                cursor: 'pointer'
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                ...badgeStyle,
                borderRadius: '9999px',
                overflow: 'hidden',
                justifyContent: 'center',
                alignItems: 'center',
                display: 'flex'
              }}>
                {index <= 2 ? (
                  <div style={{
                    width: '28px',
                    height: '28px',
                    background: index === 0 ? 'var(--Yellow-500, #FFD60A)' : 
                               index === 1 ? 'var(--Greyscale-300, #CCCCCC)' : 
                               '#DE7E3E',
                    borderRadius: '9999px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    display: 'flex'
                  }}>
                    <div style={{
                      textAlign: 'center',
                      justifyContent: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      color: badgeStyle.color,
                      fontSize: '16px',
                      fontFamily: 'Brockmann',
                      fontWeight: '700',
                      lineHeight: '24px',
                      wordWrap: 'break-word'
                    }}>
                      {index + 1}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: badgeStyle.color,
                    fontSize: '16px',
                    fontFamily: 'Brockmann',
                    fontWeight: '700',
                    lineHeight: '24px',
                    wordWrap: 'break-word'
                  }}>
                    {index + 1}
                  </div>
                )}
              </div>
              <div style={{
                flex: '1 1 0',
                paddingBottom: '2px',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                gap: '2px',
                display: 'inline-flex'
              }}>
                <div style={{
                  alignSelf: 'stretch',
                  justifyContent: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  color: selectedCategory === category.categoryName ? 'var(--Greyscale-(Blue)-800, #2B2D2D)' : 'var(--Text-Primary, #2B2D2D)',
                  fontSize: '16px',
                  fontFamily: 'Brockmann',
                  fontWeight: '600',
                  lineHeight: '24px',
                  letterSpacing: '0.32px',
                  wordWrap: 'break-word'
                }}>
                  {category.categoryName}
                </div>
                <div style={{
                  alignSelf: 'stretch',
                  justifyContent: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  color: selectedCategory === category.categoryName ? 'var(--Greyscale-(Blue)-800, #2B2D2D)' : 'var(--Text-Primary, #2B2D2D)',
                  fontSize: '14px',
                  fontFamily: 'Brockmann',
                  fontWeight: '400',
                  lineHeight: '20px',
                  wordWrap: 'break-word'
                }}>
                  Best: {category.topPick.movie_title}
                </div>
              </div>
              <div style={{
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                display: 'inline-flex'
              }}>
                <div style={{
                  alignSelf: 'stretch',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-end',
                  display: 'flex'
                }}>
                  <div style={{
                    textAlign: 'right',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'var(--Brand-Primary, #680AFF)',
                    fontSize: '32px',
                    fontFamily: 'Brockmann',
                    fontWeight: '500',
                    lineHeight: '36px',
                    letterSpacing: '1.28px',
                    wordWrap: 'break-word'
                  }}>
                    {category.averageScore.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryLeaderboard;
