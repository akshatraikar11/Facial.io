import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@clerk/clerk-react';
import { MapPin, Plus, Trash2, Copy, X } from 'lucide-react';
import { api } from '../../services/api';
import type { Location } from '../../types';

const useOrgId = () => {
  const { organization } = useOrganization();
  return (organization?.id as string) ?? '';
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  border: '1px solid var(--md-sys-color-outline-variant)',
  fontSize: '14px', background: 'var(--md-sys-color-surface)',
  color: 'var(--md-sys-color-on-surface)', boxSizing: 'border-box',
};

/** Converts a display name to a URL-safe slug e.g. "Main Gate" → "main-gate" */
const toSlug = (name: string) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const LocationsPage = () => {
  const orgId = useOrgId();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [slugOverride, setSlugOverride] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: locations = [], isLoading } = useQuery<Location[]>({
    queryKey: ['locations', orgId],
    queryFn: async () => (await api.get('/locations')).data,
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post('/locations', {
        locationId: slugOverride || toSlug(name),
        name: name.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locations'] });
      setShowForm(false);
      setName(''); setDescription(''); setSlugOverride(''); setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: (locationId: string) => api.delete(`/locations/${locationId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
    onError: (err: Error) => setError(err.message),
  });

  const slug = slugOverride || toSlug(name);
  const kioskUrl = orgId ? `${window.location.origin}/kiosk?org=${orgId}&location=${slug}` : '';

  const copyUrl = (loc: Location) => {
    const url = `${window.location.origin}/kiosk?org=${orgId}&location=${loc.locationId}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Locations</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--md-sys-color-on-surface-variant)' }}>
            Each location gets its own kiosk URL for multi-gate check-in.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(null); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--md-sys-color-primary)', color: '#fff',
            border: 'none', borderRadius: '10px', padding: '10px 18px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={16} /> Add Location
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px',
          background: 'var(--md-sys-color-error-container)',
          color: 'var(--md-sys-color-on-error-container)',
          fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none',
            border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '16px' }}>×</button>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div style={{ background: 'var(--md-sys-color-surface-variant)', borderRadius: '16px',
          padding: '24px', marginBottom: '24px', border: '1px solid var(--md-sys-color-outline-variant)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>New Location</h3>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              placeholder="Display name (e.g. Main Gate)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder={`Slug — auto: "${toSlug(name) || 'main-gate'}"`}
              value={slugOverride}
              onChange={(e) => setSlugOverride(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              style={inputStyle}
            />
            <input
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={inputStyle}
            />
            {name && (
              <p style={{ margin: 0, fontSize: '12px', color: '#5f6368',
                background: '#f1f3f4', borderRadius: '8px', padding: '8px 12px', fontFamily: 'monospace' }}>
                🔗 {window.location.origin}/kiosk?org={orgId}&location={slug}
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => create.mutate()}
                disabled={!name.trim() || create.isPending}
                style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none',
                  background: name.trim() ? 'var(--md-sys-color-primary)' : '#ccc',
                  color: '#fff', cursor: name.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 600, fontSize: '14px' }}
              >
                {create.isPending ? 'Saving...' : 'Save Location'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Locations table */}
      <div style={{ background: 'var(--md-sys-color-surface)', borderRadius: '16px',
        border: '1px solid var(--md-sys-color-outline-variant)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--md-sys-color-surface-variant)' }}>
              {['Name', 'Slug', 'Kiosk URL', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '12px 20px', textAlign: 'left',
                  fontSize: '12px', fontWeight: 600, color: 'var(--md-sys-color-on-surface-variant)',
                  textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Loading...</td></tr>
            ) : locations.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '48px', textAlign: 'center' }}>
                  <MapPin size={32} color="#ccc" style={{ marginBottom: '8px' }} />
                  <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>
                    No locations yet. Add one to enable multi-gate check-in.
                  </p>
                </td>
              </tr>
            ) : (
              locations.map((loc) => {
                const url = `${window.location.origin}/kiosk?org=${orgId}&location=${loc.locationId}`;
                return (
                  <tr key={loc._id} style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MapPin size={14} color="#0b57d0" />
                        {loc.name}
                        {loc.description && (
                          <span style={{ fontSize: '11px', color: '#9aa0a6', fontWeight: 400 }}>
                            — {loc.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <code style={{ fontSize: '12px', background: '#f1f3f4',
                        padding: '3px 8px', borderRadius: '6px' }}>
                        {loc.locationId}
                      </code>
                    </td>
                    <td style={{ padding: '14px 20px', maxWidth: '300px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#5f6368', fontFamily: 'monospace',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: '240px' }}>
                          {url}
                        </span>
                        <button
                          onClick={() => copyUrl(loc)}
                          title="Copy kiosk URL"
                          style={{ background: 'none', border: 'none', cursor: 'pointer',
                            color: '#5f6368', padding: '4px', flexShrink: 0 }}
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove location "${loc.name}"?`)) {
                            remove.mutate(loc.locationId);
                          }
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--md-sys-color-error)', padding: '4px' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LocationsPage;
