const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/clients/ClientsClient.tsx', 'utf-8');

const sidebarStart = '{/* ── RIGHT-SIDE GLASSMORPHIC SHEET DRAWER ── */}';
const sidebarEnd = '{/* --- ADD CLIENT MODAL --- */}';

const sidebarIdx = code.indexOf(sidebarStart);
const addModalIdx = code.indexOf(sidebarEnd);

if (sidebarIdx === -1 || addModalIdx === -1) {
  console.log('Could not find sidebar boundaries');
  process.exit(1);
}

const sidebarBlock = code.substring(sidebarIdx, addModalIdx);
code = code.substring(0, sidebarIdx) + code.substring(addModalIdx);

const rowEndMarker = '</tr>\n\n                    </Fragment>';
const accordionJSX = `</tr>
                      {isExpanded && (
                        <tr className="expanded-accordion-row">
                          <td colSpan={9} style={{ padding: 0, background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,193,125,0.15)' }}>
                            <div style={{ padding: '2rem', borderTop: '1px solid rgba(229,193,125,0.1)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2rem', flexWrap: 'wrap' }}>
                                {/* Left Side: Ledger & Identity */}
                                <div style={{ flex: '1 1 400px' }}>
                                  <h3 style={{ margin: '0 0 1.5rem 0', color: '#ae9260', fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <History size={20} />
                                    <span>Client Profile & Ledger</span>
                                  </h3>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                      <span style={{ fontSize: '0.7rem', color: '#ae9260', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Lifetime Revenue</span>
                                      <div style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700, marginTop: '0.25rem' }}>{stats.totalSpent.toFixed(2)} DT</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                      <span style={{ fontSize: '0.7rem', color: '#ae9260', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Net LTV (Rev - Dmg)</span>
                                      <div style={{ 
                                        color: stats.netLTV < 0 ? '#ef4444' : '#10b981', 
                                        fontSize: '1.25rem', 
                                        fontWeight: 700, 
                                        marginTop: '0.25rem',
                                        textShadow: stats.netLTV < 0 ? '0 0 8px rgba(239, 68, 68, 0.4)' : 'none'
                                      }}>
                                        {stats.netLTV.toFixed(2)} DT
                                      </div>
                                    </div>
                                    <div style={{ background: 'rgba(239,68,68,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                      <span style={{ fontSize: '0.7rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Outstanding Debt</span>
                                      <div style={{ color: '#ef4444', fontSize: '1.25rem', fontWeight: 700, marginTop: '0.25rem' }}>{stats.totalOwed.toFixed(2)} DT</div>
                                    </div>
                                    <div style={{ background: 'rgba(245,158,11,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)' }}>
                                      <span style={{ fontSize: '0.7rem', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Damage Logs</span>
                                      <div style={{ color: '#f59e0b', fontSize: '1.25rem', fontWeight: 700, marginTop: '0.25rem' }}>{stats.damageOutflows.toFixed(2)} DT</div>
                                    </div>
                                  </div>
                                </div>

                                {/* Right Side: Timeline */}
                                <div style={{ flex: '1 1 500px', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <h4 style={{ margin: '0 0 1.5rem 0', color: '#ae9260', fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Rental Timeline
                                  </h4>
                                  {stats.bookingsList.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'rgba(255, 255, 255, 0.3)', fontSize: '0.9rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                      No historical bookings linked to this client yet.
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                                      <div style={{ position: 'absolute', left: '15px', top: '0', bottom: '0', width: '2px', background: 'rgba(229,193,125,0.1)' }}></div>
                                      
                                      {stats.bookingsList.slice().reverse().map((booking) => {
                                        const remains = Math.max(0, Number(booking.total_amount) - (Number(booking.acompte_paid) || 0));
                                        const plateNumber = booking.vehicle?.license_plate || booking.vehicles?.license_plate || '—';
                                        const vehicleName = booking.vehicle 
                                          ? \`\${booking.vehicle.brand} \${booking.vehicle.model}\` 
                                          : booking.vehicles 
                                            ? \`\${booking.vehicles.brand} \${booking.vehicles.model}\` 
                                            : 'Deleted Vehicle';
                                        
                                        const incidentExpenses = stats.clientExpenses.filter(e => e.vehicle_id === booking.vehicle_id && new Date(e.created_at || '') >= new Date(booking.start_date) && new Date(e.created_at || '') <= new Date(booking.actual_return_date || booking.end_date || new Date().toISOString()))

                                        return (
                                          <div key={booking.id} style={{ position: 'relative', paddingLeft: '2.5rem' }}>
                                            <div style={{ position: 'absolute', left: '11px', top: '16px', width: '10px', height: '10px', borderRadius: '50%', background: booking.status === 'completed' ? '#10b981' : booking.status === 'confirmed' ? '#3b82f6' : '#f59e0b', boxShadow: '0 0 0 4px rgba(10,8,7,1)' }}></div>
                                            
                                            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '1rem' }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                <div>
                                                  <div style={{ color: '#ae9260', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                                    {new Date(booking.start_date).toLocaleDateString('en-GB')} - {new Date(booking.end_date).toLocaleDateString('en-GB')}
                                                  </div>
                                                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{vehicleName}</div>
                                                  <div style={{ display: 'inline-flex', alignItems: 'center', background: '#111', border: '1px solid rgba(229, 193, 125, 0.4)', borderRadius: '4px', padding: '0.1rem 0.4rem', fontFamily: 'monospace', fontWeight: 'bold', color: '#fff', fontSize: '0.7rem' }}>
                                                    <span style={{ color: '#ae9260', marginRight: '0.3rem', borderRight: '1px solid rgba(229, 193, 125, 0.2)', paddingRight: '0.3rem' }}>TN</span>
                                                    <span>{plateNumber}</span>
                                                  </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>{Number(booking.total_amount).toFixed(2)} DT</div>
                                                  <div style={{ fontSize: '0.75rem', color: remains > 0 ? '#ef4444' : '#10b981', fontWeight: 600, marginTop: '0.25rem' }}>
                                                    {remains > 0 ? \`Unpaid: \${remains.toFixed(2)} DT\` : 'Fully Paid'}
                                                  </div>
                                                </div>
                                              </div>
                                              
                                              {(booking.client_behavior_status || incidentExpenses.length > 0) && (
                                                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                  {booking.client_behavior_status && (
                                                    <div style={{ fontSize: '0.75rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                                                      <ShieldAlert size={12} />
                                                      Flags: {booking.client_behavior_status.replace(/_/g, ' ')}
                                                    </div>
                                                  )}
                                                  {incidentExpenses.map(e => (
                                                    <div key={e.id} style={{ fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                      <span>Damage Logged:</span>
                                                      <span style={{ fontWeight: 600 }}>{Number(e.amount).toFixed(2)} DT</span>
                                                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>({e.description})</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                    </Fragment>`;

code = code.replace(rowEndMarker, accordionJSX);
fs.writeFileSync('src/app/dashboard/clients/ClientsClient.tsx', code);
console.log('Fixed successfully');
