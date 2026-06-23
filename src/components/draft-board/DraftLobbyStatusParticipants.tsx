import { Copy, Check, Clock, Film } from 'lucide-react';
import { isParticipantOnline } from '@/utils/draftPresence';
import { MultiPersonIcon } from '@/components/icons/MultiPersonIcon';
import { PersonIcon } from '@/components/icons/PersonIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface LobbyParticipant {
  id: string;
  participant_name: string;
  participant_id?: string;
  user_id?: string | null;
  guest_participant_id?: string | null;
  is_ai?: boolean;
  is_host?: boolean;
  status: 'invited' | 'joined' | 'left' | string;
  email?: string | null;
  avatar_url?: string | null;
  last_seen_at?: string | null;
}

function getParticipantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function ParticipantGridAvatar({
  avatarUrl,
  name,
  email,
  isOnline,
}: {
  avatarUrl?: string | null;
  name: string;
  email?: string | null;
  isOnline: boolean;
}) {
  const avatarSize = 64;

  let avatarNode: React.ReactNode;

  if (isOnline) {
    avatarNode = (
      <div
        data-show-online-status="true"
        style={{
          width: avatarSize,
          height: avatarSize,
          position: 'relative',
          borderRadius: '9999px',
          backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: avatarUrl ? undefined : 'var(--Greyscale-Blue-800, #1A1D29)',
          justifyContent: 'flex-end',
          alignItems: 'flex-end',
          display: 'flex',
        }}
      >
        {!avatarUrl && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '9999px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'var(--Text-Primary, #FCFFFF)',
              fontSize: '18px',
              fontFamily: 'Brockmann',
              fontWeight: '600',
            }}
          >
            {getParticipantInitials(name)}
          </div>
        )}
        <div
          style={{
            width: '12px',
            height: '12px',
            background: 'var(--Utility-Colors-Positive-Green-400, #41DA86)',
            borderRadius: '9999px',
          }}
        />
      </div>
    );
  } else if (avatarUrl) {
    avatarNode = (
      <img
        src={avatarUrl}
        alt=""
        data-show-online-status="false"
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: '9999px',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    );
  } else {
    avatarNode = (
      <div
        data-show-online-status="false"
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: '9999px',
          background: 'var(--Greyscale-Blue-800, #1A1D29)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'var(--Text-Primary, #FCFFFF)',
          fontSize: '18px',
          fontFamily: 'Brockmann',
          fontWeight: '600',
        }}
      >
        {getParticipantInitials(name)}
      </div>
    );
  }

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${name}${email ? `, ${email}` : ''}`}
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: 'default',
            display: 'inline-flex',
          }}
        >
          {avatarNode}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        className="border-0 bg-transparent p-0 shadow-none"
      >
        <div
          style={{
            padding: '8px 12px',
            background: 'var(--UI-Primary, #1D1D1F)',
            borderRadius: '9999px',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: '2px',
            display: 'inline-flex',
            maxWidth: '280px',
          }}
        >
          <div
            style={{
              color: 'var(--Text-Primary, #FCFFFF)',
              fontSize: '13px',
              fontFamily: 'Brockmann',
              fontWeight: '600',
              lineHeight: '18px',
              wordWrap: 'break-word',
              whiteSpace: 'normal',
            }}
          >
            {name}
          </div>
          {email && (
            <div
              style={{
                color: 'var(--Text-Light-grey, #BDC3C2)',
                fontSize: '12px',
                fontFamily: 'Brockmann',
                fontWeight: '400',
                lineHeight: '16px',
                wordWrap: 'break-word',
                whiteSpace: 'normal',
              }}
            >
              {email}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface DraftLobbyStatusParticipantsProps {
  draft: {
    id: string;
    current_pick_number?: number | null;
    invite_code?: string | number | null;
    current_turn_participant_id?: string | null;
    current_turn_user_id?: string | null;
  };
  isComplete: boolean;
  draftHasStarted: boolean;
  isHost: boolean;
  isMyTurn: boolean;
  currentTurnPlayer?: LobbyParticipant | null;
  participants: LobbyParticipant[];
  sortedParticipants: LobbyParticipant[];
  joinedParticipantsCount: number;
  presenceNowMs: number;
  copySuccess: boolean;
  loading: boolean;
  onCopyInviteCode: () => void;
  onStartDraft: () => void;
}

export function DraftLobbyStatusParticipants({
  draft,
  isComplete,
  draftHasStarted,
  isHost,
  isMyTurn,
  currentTurnPlayer,
  participants,
  sortedParticipants,
  joinedParticipantsCount,
  presenceNowMs,
  copySuccess,
  loading,
  onCopyInviteCode,
  onStartDraft,
}: DraftLobbyStatusParticipantsProps) {
  const getParticipantsSortedByCreatedAt = sortedParticipants;

  return (
    <>
        {/* Start Draft Button - Show only to host when conditions are met */}
        {!draftHasStarted && participants.length >= 2 && !isComplete && isHost && <div style={{width: '100%', height: '100%', padding: '24px', marginTop: '0', borderRadius: '8px', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
            <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: '16px', display: 'flex'}}>
              <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex'}}>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', display: 'flex'}}>
                  <div style={{textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '20px', fontFamily: 'Brockmann', fontWeight: '500', lineHeight: '28px', wordWrap: 'break-word'}}>Everybody Ready?</div>
                </div>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', display: 'flex'}}>
                  <div style={{alignSelf: 'stretch', textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Light-grey, #BDC3C2)', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word'}}>{joinedParticipantsCount} {joinedParticipantsCount === 1 ? 'player has' : 'players have'} joined. Click below to randomize turn order and start the draft!</div>
                </div>
              </div>
              <div 
                onClick={onStartDraft}
                onMouseEnter={(e) => e.currentTarget.style.background = '#794DFF'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--Purple-500, #680AFF)'}
                style={{paddingLeft: '32px', paddingRight: '32px', paddingTop: '16px', paddingBottom: '16px', background: 'var(--Purple-500, #680AFF)', borderRadius: '2px', justifyContent: 'center', alignItems: 'center', display: 'inline-flex', cursor: 'pointer', transition: 'background 0.2s ease'}}
              >
                <div style={{textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '18px', fontFamily: 'Brockmann', fontWeight: '600', lineHeight: '24px', wordWrap: 'break-word'}}>
                  {loading ? 'Starting...' : 'Start Draft'}
                </div>
              </div>
            </div>
          </div>}

        {/* Status and Participants */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px 24px',
          justifyContent: 'center',
          alignItems: 'flex-start',
          width: '100%'
        }}>
          <div style={{
            flex: '1 1 0',
            minWidth: '342px',
            height: '100%', 
            padding: '24px', 
            background: 'var(--Section-Container, #0E0E0F)', 
            boxShadow: '0px 0px 6px #3B0394', 
            borderRadius: '8px', 
            flexDirection: 'column', 
            justifyContent: 'flex-start', 
            alignItems: 'flex-start', 
            gap: '24px', 
            display: 'inline-flex'
          }}>
            <div style={{alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'center', gap: '8px', display: 'inline-flex'}}>
              <div style={{width: '24px', padding: '2px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px', display: 'inline-flex'}}>
                <Clock size={24} color="#907AFF" />
              </div>
              <div style={{
                flex: '1 1 0', 
                justifyContent: 'center', 
                display: 'flex', 
                flexDirection: 'column', 
                color: 'var(--Text-Primary, #FCFFFF)', 
                fontSize: '20px', 
                fontFamily: 'Brockmann', 
                fontWeight: '500', 
                lineHeight: '28px', 
                wordWrap: 'break-word'
              }}>Draft Status</div>
            </div>
            
            {isComplete ? (
              <>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '12px', display: 'flex'}}>
                  <div style={{
                    alignSelf: 'stretch', 
                    textAlign: 'center', 
                    justifyContent: 'center', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    color: 'var(--Text-Primary, #FCFFFF)', 
                    fontSize: '16px', 
                    fontFamily: 'Brockmann', 
                    fontWeight: '600', 
                    lineHeight: '24px', 
                    wordWrap: 'break-word'
                  }}>Draft Complete</div>
                  <div style={{
                    alignSelf: 'stretch', 
                    textAlign: 'center', 
                    justifyContent: 'center', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    color: 'var(--Text-Light-grey, #BDC3C2)', 
                    fontSize: '14px', 
                    fontFamily: 'Brockmann', 
                    fontWeight: '400', 
                    lineHeight: '20px', 
                    wordWrap: 'break-word'
                  }}>All picks have been made!</div>
                </div>
              </>
            ) : (
              <>
                {!draftHasStarted && participants.length >= 2 && !isHost ? (
                  <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: '8px', display: 'flex'}}>
                    <div style={{
                      alignSelf: 'stretch',
                      textAlign: 'center',
                      justifyContent: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      color: 'var(--Text-Primary, #FCFFFF)',
                      fontSize: '16px',
                      fontFamily: 'Brockmann',
                      fontWeight: '600',
                      lineHeight: '24px',
                      wordWrap: 'break-word'
                    }}>
                      Waiting on the Host to start the draft
                    </div>
                    <div style={{
                      alignSelf: 'stretch',
                      textAlign: 'center',
                      justifyContent: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      color: 'var(--Text-Light-grey, #BDC3C2)',
                      fontSize: '14px',
                      fontFamily: 'Brockmann',
                      fontWeight: '400',
                      lineHeight: '20px',
                      wordWrap: 'break-word'
                    }}>
                      The host will begin the draft when ready.
                    </div>
                  </div>
                ) : (
                <>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '12px', display: 'flex'}}>
                  <div style={{alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex'}}>
                    <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
                      <div style={{
                        justifyContent: 'center', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        color: 'var(--Text-Light-grey, #BDC3C2)', 
                        fontSize: '14px', 
                        fontFamily: 'Brockmann', 
                        fontWeight: '400', 
                        lineHeight: '20px', 
                        wordWrap: 'break-word'
                      }}>Pick Number:</div>
                    </div>
                    <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
                      <div style={{
                        justifyContent: 'center', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        color: 'var(--Text-Primary, #FCFFFF)', 
                        fontSize: '14px', 
                        fontFamily: 'Brockmann', 
                        fontWeight: '500', 
                        lineHeight: '20px', 
                        wordWrap: 'break-word'
                      }}>{draft.current_pick_number}</div>
                    </div>
                  </div>
                  <div style={{alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex', gap: '12px', minWidth: 0}}>
                    <div style={{flexShrink: 0, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
                      <div style={{
                        justifyContent: 'center', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        color: 'var(--Text-Light-grey, #BDC3C2)', 
                        fontSize: '14px', 
                        fontFamily: 'Brockmann', 
                        fontWeight: '400', 
                        lineHeight: '20px', 
                        wordWrap: 'break-word'
                      }}>Current Turn:</div>
                    </div>
                    <div
                      title={currentTurnPlayer?.participant_name || 'Unknown'}
                      style={{
                        flex: '1 1 0',
                        minWidth: 0,
                        justifyContent: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        color: 'var(--Text-Primary, #FCFFFF)',
                        fontSize: '14px',
                        fontFamily: 'Brockmann',
                        fontWeight: '500',
                        lineHeight: '20px',
                        textAlign: 'right',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >{currentTurnPlayer?.participant_name || 'Unknown'}</div>
                  </div>
                </div>
                {!isMyTurn && draftHasStarted && (
                  <div style={{
                    width: '100%', 
                    height: '100%', 
                    paddingTop: '22px', 
                    paddingBottom: '24px', 
                    paddingLeft: '24px', 
                    paddingRight: '24px', 
                    background: 'var(--UI-Primary, #1D1D1F)', 
                    borderRadius: '8px', 
                    outline: '1px var(--Item-Stroke, #49474B) solid', 
                    outlineOffset: '-1px', 
                    flexDirection: 'column', 
                    justifyContent: 'flex-start', 
                    alignItems: 'flex-start', 
                    display: 'inline-flex'
                  }}>
                    <div style={{
                      alignSelf: 'stretch', 
                      flexDirection: 'column', 
                      justifyContent: 'flex-start', 
                      alignItems: 'center', 
                      gap: '12px', 
                      display: 'flex'
                    }}>
                      <div style={{
                        width: '24px', 
                        padding: '2px', 
                        flexDirection: 'column', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        gap: '10px', 
                        display: 'flex'
                      }}>
                        <Clock size={20} color="#BDC3C2" />
                      </div>
                      <div style={{
                        alignSelf: 'stretch', 
                        flexDirection: 'column', 
                        justifyContent: 'flex-start', 
                        alignItems: 'center', 
                        gap: '4px', 
                        display: 'flex'
                      }}>
                        <div
                          title={currentTurnPlayer?.participant_name ? `Waiting for ${currentTurnPlayer.participant_name}` : undefined}
                          style={{
                            alignSelf: 'stretch',
                            textAlign: 'center',
                            justifyContent: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            color: 'var(--Text-Primary, #FCFFFF)',
                            fontSize: '16px',
                            fontFamily: 'Brockmann',
                            fontWeight: '600',
                            lineHeight: '24px',
                            letterSpacing: '0.32px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            minWidth: 0,
                            paddingLeft: '8px',
                            paddingRight: '8px',
                          }}
                        >
                          Waiting for {currentTurnPlayer?.participant_name}
                        </div>
                        <div style={{
                          alignSelf: 'stretch', 
                          textAlign: 'center', 
                          justifyContent: 'center', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          color: 'var(--Text-Light-grey, #BDC3C2)', 
                          fontSize: '14px', 
                          fontFamily: 'Brockmann', 
                          fontWeight: '400', 
                          lineHeight: '20px', 
                          wordWrap: 'break-word'
                        }}>
                          It's their turn to make a pick
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {isMyTurn && (
                  <div style={{width: '100%', height: '100%', padding: '24px', background: 'var(--Purple-800, #25015E)', borderRadius: '8px', outline: '3px var(--Purple-500, #680AFF) solid', outlineOffset: '-3px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', display: 'inline-flex'}}>
                    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: '12px', display: 'flex'}}>
                      <div style={{width: '24px', height: '24px', padding: '2px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px', display: 'flex'}}>
                        <Film size={24} color="#FFD60A" />
                      </div>
                      <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: '3px', display: 'flex'}}>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '16px', fontFamily: 'Brockmann', fontWeight: '600', lineHeight: '24px', letterSpacing: '0.32px', wordWrap: 'break-word'}}>It's Your Turn!</div>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word'}}>Make your next pick to your movie roster</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
                )}
              </>
            )}
          </div>

          {/* Unified participants container with background treatment */}
          <div style={{
            flex: '1 1 0',
            minWidth: '342px',
            height: '100%', 
            padding: '24px', 
            background: 'var(--Section-Container, #0E0E0F)', 
            boxShadow: '0px 0px 6px #3B0394', 
            borderRadius: '8px', 
            flexDirection: 'column', 
            justifyContent: 'flex-start', 
            alignItems: 'flex-start', 
            gap: '24px', 
            display: 'inline-flex'
          }}>
            {/* Join Code section */}
            <div style={{
              width: '100%',
              height: '100%',
              justifyContent: 'space-between',
              alignItems: 'center',
              display: 'inline-flex',
              flexWrap: 'wrap',
              alignContent: 'center',
              rowGap: '12px',
            }}>
              <div style={{
                flex: '0 0 auto',
                minWidth: '120px',
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column',
                color: 'var(--Text-Primary, #FCFFFF)',
                fontSize: '24px',
                fontFamily: 'Brockmann',
                fontWeight: '700',
                lineHeight: '24px',
                letterSpacing: '0.24px',
                wordWrap: 'break-word',
              }}>
                Join Code
              </div>
              {draft.invite_code && (
                <div style={{
                  flex: '1 1 auto',
                  minWidth: 'min(100%, 295px)',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-end',
                  gap: '10px',
                  display: 'inline-flex',
                }}>
                  <div style={{
                    alignSelf: 'stretch',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: '8px',
                    display: 'inline-flex',
                  }}>
                    <div style={{
                      paddingLeft: '14px',
                      paddingRight: '14px',
                      paddingTop: '4px',
                      paddingBottom: '4px',
                      background: 'var(--UI-Primary, #1D1D1F)',
                      borderRadius: '9999px',
                      outline: '1px var(--Text-Primary, #FCFFFF) solid',
                      outlineOffset: '-1px',
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      display: 'flex',
                    }}>
                      <div style={{
                        justifyContent: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        color: 'var(--Text-Primary, #FCFFFF)',
                        fontSize: '18px',
                        fontFamily: 'Replica-Mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                        fontWeight: '400',
                        lineHeight: '28px',
                        letterSpacing: '1.08px',
                        wordWrap: 'break-word',
                      }}>
                        {draft.invite_code}
                      </div>
                    </div>
                    <button
                      onClick={onCopyInviteCode}
                      style={{
                        paddingLeft: '12px',
                        paddingRight: '12px',
                        paddingTop: '8px',
                        paddingBottom: '8px',
                        background: 'var(--UI-Primary, #1D1D1F)',
                        borderRadius: '2px',
                        outline: '1px var(--Text-Primary, #FCFFFF) solid',
                        outlineOffset: '-1px',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '8px',
                        display: 'flex',
                        cursor: 'pointer',
                        border: 'none',
                      }}
                    >
                      <div style={{
                        textAlign: 'center',
                        justifyContent: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        color: 'var(--Text-Primary, #FCFFFF)',
                        fontSize: '14px',
                        fontFamily: 'Brockmann',
                        fontWeight: '500',
                        lineHeight: '20px',
                        wordWrap: 'break-word',
                      }}>
                        {copySuccess ? 'Copied!' : 'Copy'}
                      </div>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '10px',
                        display: 'inline-flex',
                      }}>
                        {copySuccess ? <Check size={16} color="#FCFFFF" /> : <Copy size={16} color="#FCFFFF" />}
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Participants section */}
            <div style={{
              width: '100%',
              height: '100%',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              gap: '16px',
              display: 'inline-flex',
            }}>
              <div
                data-show-icons="true"
                style={{
                  alignSelf: 'stretch',
                  height: '28px',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: '8px',
                  display: 'inline-flex',
                }}
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  padding: '2px',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '10px',
                  display: 'inline-flex',
                  color: 'var(--Text-Purple, #907AFF)',
                }}>
                  <MultiPersonIcon className="w-6 h-6" />
                </div>
                <div style={{
                  flex: '1 1 0',
                  justifyContent: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  color: 'var(--Text-Primary, #FCFFFF)',
                  fontSize: '20px',
                  fontFamily: 'Brockmann',
                  fontWeight: '500',
                  lineHeight: '28px',
                  wordWrap: 'break-word',
                }}>
                  Participants
                </div>
              </div>

              <div style={{
                alignSelf: 'stretch',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                gap: '18px',
                display: 'inline-flex',
                flexWrap: 'wrap',
                alignContent: 'flex-start',
              }}>
                {getParticipantsSortedByCreatedAt.map((participant) => (
                  <ParticipantGridAvatar
                    key={participant.id}
                    avatarUrl={participant.avatar_url}
                    name={participant.participant_name}
                    email={participant.email}
                    isOnline={isParticipantOnline(participant, presenceNowMs)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Waiting for Players - Show when not enough players */}
        {!draftHasStarted && participants.length < 2 && <div style={{width: '100%', height: '100%', padding: '24px', borderRadius: '8px', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
            <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: '16px', display: 'flex'}}>
              <div style={{width: '24px', height: '24px', padding: '2px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px', display: 'flex', color: '#FCFFFF'}}>
                <PersonIcon className="w-6 h-6" />
              </div>
              <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex'}}>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', display: 'flex'}}>
                  <div style={{textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '20px', fontFamily: 'Brockmann', fontWeight: '500', lineHeight: '28px', wordWrap: 'break-word'}}>Waiting For Players</div>
                </div>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', display: 'flex'}}>
                  <div style={{alignSelf: 'stretch', textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Light-grey, #BDC3C2)', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word'}}>Need at least 2 players to start the draft. Share the invite code above!</div>
                </div>
              </div>
            </div>
          </div>}
    </>
  );
}
