/**
 * Promo Screen — Build 029
 *
 * Promotional page configuration with AI-generated content.
 * Auto-save on blur for text fields.
 * Route: /projects/:id/promo
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPromoConfig,
  savePromoConfig,
  togglePromoPage,
  generatePromoContent,
  isPromoPublishable,
} from '@/api/promo';
import { getProject } from '@/api/projects';
import type { PromoPageConfig, PromoStep, PromoFeatureCard } from '@/types/db';
import type { Project } from '@/types/db';
import { extractErrorMessage } from '@/lib/extractErrorMessage';

const T = {
  bg: '#0f0f10',
  surface: '#1a1a1c',
  surface2: '#222224',
  surface3: '#2c2c2e',
  border: '#2c2c2e',
  text: '#e8e8ea',
  text2: '#8e8e93',
  accent: '#0a84ff',
  green: '#30d158',
  red: '#ff453a',
  orange: '#ff9f0a',
};

// ── Step Editor ────────────────────────────────────────────────────────────

function StepEditor({
  step,
  index,
  onUpdate,
  onRemove,
}: {
  step: PromoStep;
  index: number;
  onUpdate: (step: PromoStep) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        backgroundColor: T.surface2,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        border: `1px solid ${T.border}`,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 4,
            backgroundColor: T.surface3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: T.text2,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {step.number}
        </div>
        <div style={{ flex: 1 }}>
          <input
            data-testid={`step-title-${index}`}
            type="text"
            value={step.title}
            onChange={(e) => onUpdate({ ...step, title: e.target.value })}
            placeholder="Step title"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: `1px solid ${T.border}`,
              backgroundColor: T.surface,
              color: T.text,
              fontSize: 13,
              fontFamily: 'inherit',
              marginBottom: 8,
            }}
          />
          <textarea
            data-testid={`step-description-${index}`}
            value={step.description}
            onChange={(e) => onUpdate({ ...step, description: e.target.value })}
            placeholder="Step description"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: `1px solid ${T.border}`,
              backgroundColor: T.surface,
              color: T.text,
              fontSize: 13,
              fontFamily: 'inherit',
              minHeight: 60,
              resize: 'vertical',
            }}
          />
        </div>
        <button
          data-testid={`remove-step-btn-${index}`}
          onClick={onRemove}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: `1px solid ${T.red}`,
            backgroundColor: 'transparent',
            color: T.red,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// ── Feature Card Editor ────────────────────────────────────────────────────

function FeatureEditor({
  feature,
  index,
  onUpdate,
  onRemove,
}: {
  feature: PromoFeatureCard;
  index: number;
  onUpdate: (feature: PromoFeatureCard) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        backgroundColor: T.surface2,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        border: `1px solid ${T.border}`,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
        <input
          type="text"
          value={feature.icon}
          onChange={(e) => onUpdate({ ...feature, icon: e.target.value })}
          placeholder="Icon (emoji)"
          style={{
            width: 50,
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${T.border}`,
            backgroundColor: T.surface,
            color: T.text,
            fontSize: 13,
            fontFamily: 'inherit',
            textAlign: 'center',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <input
            data-testid={`feature-title-${index}`}
            type="text"
            value={feature.title}
            onChange={(e) => onUpdate({ ...feature, title: e.target.value })}
            placeholder="Feature title"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: `1px solid ${T.border}`,
              backgroundColor: T.surface,
              color: T.text,
              fontSize: 13,
              fontFamily: 'inherit',
              marginBottom: 8,
            }}
          />
          <textarea
            data-testid={`feature-description-${index}`}
            value={feature.description}
            onChange={(e) => onUpdate({ ...feature, description: e.target.value })}
            placeholder="Feature description"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: `1px solid ${T.border}`,
              backgroundColor: T.surface,
              color: T.text,
              fontSize: 13,
              fontFamily: 'inherit',
              minHeight: 60,
              resize: 'vertical',
            }}
          />
        </div>
        <button
          data-testid={`remove-feature-btn-${index}`}
          onClick={onRemove}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: `1px solid ${T.red}`,
            backgroundColor: 'transparent',
            color: T.red,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function PromoScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  if (!projectId) return <div>Project not found</div>;

  const [project, setProject] = useState<Project | null>(null);
  const [config, setConfig] = useState<PromoPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_unsavedChanges, setUnsavedChanges] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectData, configData] = await Promise.all([
        getProject(projectId),
        getPromoConfig(projectId),
      ]);
      setProject(projectData);
      setConfig(configData ?? null);
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, 'Failed to load promo config'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveField = async (patch: Partial<PromoPageConfig>) => {
    if (!config) return;
    setSaving(true);
    try {
      await savePromoConfig(projectId, patch);
      setConfig({ ...config, ...patch });
      setUnsavedChanges(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePromo = async () => {
    if (!config) return;

    if (!config.promo_enabled && !isPromoPublishable(config)) {
      alert(
        'Please add at least a tagline and problem description before publishing'
      );
      return;
    }

    setSaving(true);
    try {
      await togglePromoPage(projectId, !config.promo_enabled);
      setConfig({ ...config, promo_enabled: !config.promo_enabled });
    } catch (err) {
      console.error(err);
      alert('Failed to toggle promo page');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateContent = async () => {
    setGenerating(true);
    try {
      await generatePromoContent(projectId);
      // Reload config after a short delay to see generated content
      setTimeout(() => loadData(), 1000);
    } catch (err) {
      console.error(err);
      alert('Failed to generate content');
    } finally {
      setGenerating(false);
    }
  };

  const handleAddStep = () => {
    if (!config) return;
    const steps = config.promo_steps || [];
    if (steps.length >= 6) {
      alert('Maximum 6 steps allowed');
      return;
    }
    const newStep: PromoStep = {
      number: Math.max(0, ...steps.map((s) => s.number)) + 1,
      title: '',
      description: '',
    };
    setConfig({ ...config, promo_steps: [...steps, newStep] });
    setUnsavedChanges(true);
  };

  const handleRemoveStep = (index: number) => {
    if (!config?.promo_steps) return;
    const updated = config.promo_steps.filter((_, i) => i !== index);
    setConfig({ ...config, promo_steps: updated });
    setUnsavedChanges(true);
  };

  const handleUpdateStep = (index: number, step: PromoStep) => {
    if (!config?.promo_steps) return;
    const updated = [...config.promo_steps];
    updated[index] = step;
    setConfig({ ...config, promo_steps: updated });
    setUnsavedChanges(true);
  };

  const handleAddFeature = () => {
    if (!config) return;
    const features = config.promo_features || [];
    if (features.length >= 6) {
      alert('Maximum 6 features allowed');
      return;
    }
    const newFeature: PromoFeatureCard = {
      icon: '✨',
      title: '',
      description: '',
    };
    setConfig({ ...config, promo_features: [...features, newFeature] });
    setUnsavedChanges(true);
  };

  const handleRemoveFeature = (index: number) => {
    if (!config?.promo_features) return;
    const updated = config.promo_features.filter((_, i) => i !== index);
    setConfig({ ...config, promo_features: updated });
    setUnsavedChanges(true);
  };

  const handleUpdateFeature = (index: number, feature: PromoFeatureCard) => {
    if (!config?.promo_features) return;
    const updated = [...config.promo_features];
    updated[index] = feature;
    setConfig({ ...config, promo_features: updated });
    setUnsavedChanges(true);
  };

  if (loading) {
    return <div style={{ padding: 20, color: T.text }}>Loading...</div>;
  }

  if (!config || !project) {
    return <div style={{ padding: 20, color: T.text }}>Failed to load promo config</div>;
  }

  const publishable = isPromoPublishable(config);

  return (
    <div
      data-testid="promo-screen"
      style={{
        backgroundColor: T.bg,
        minHeight: '100vh',
        color: T.text,
        padding: '20px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          Promo Page
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            data-testid="promo-enabled-toggle"
            onClick={handleTogglePromo}
            disabled={saving}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: `1px solid ${config.promo_enabled ? T.green : T.border}`,
              backgroundColor: config.promo_enabled
                ? 'rgba(48, 209, 88, 0.15)'
                : 'transparent',
              color: config.promo_enabled ? T.green : T.text2,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 600,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {config.promo_enabled ? '✓ Published' : 'Unpublished'}
          </button>
          <button
            data-testid="preview-promo-btn"
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: `1px solid ${T.border}`,
              backgroundColor: 'transparent',
              color: T.accent,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            color: T.red,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* Publishable warning */}
      {!publishable && (
        <div
          data-testid="promo-publishable-warning"
          style={{
            padding: 12,
            borderRadius: 8,
            backgroundColor: 'rgba(255, 159, 10, 0.15)',
            color: T.orange,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          ⚠️ Add tagline and problem description to publish
        </div>
      )}

      {/* Business Name */}
      <div
        style={{
          backgroundColor: T.surface,
          borderRadius: 10,
          padding: 16,
          marginBottom: 20,
          border: `1px solid ${T.border}`,
        }}
      >
        <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, display: 'block', marginBottom: 8 }}>
          Business Name
        </label>
        <input
          data-testid="business-name-input"
          type="text"
          value={config.business_name || ''}
          onChange={(e) => {
            setConfig({ ...config, business_name: e.target.value });
            setUnsavedChanges(true);
          }}
          onBlur={() =>
            handleSaveField({ business_name: config.business_name || null })
          }
          placeholder={`Falls back to: ${project.name}`}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: `1px solid ${T.border}`,
            backgroundColor: T.surface2,
            color: T.text,
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Content Generation */}
      <div
        style={{
          backgroundColor: T.surface,
          borderRadius: 10,
          padding: 16,
          marginBottom: 20,
          border: `1px solid ${T.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
            Generate Content with AI
          </p>
          <p style={{ margin: 0, fontSize: 12, color: T.text2 }}>
            Auto-fill tagline, problem, steps, and features
          </p>
        </div>
        <button
          data-testid="generate-content-btn"
          onClick={handleGenerateContent}
          disabled={generating}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            backgroundColor: T.accent,
            color: '#fff',
            cursor: generating ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 600,
            opacity: generating ? 0.6 : 1,
          }}
        >
          {generating ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {/* Tagline & Overline */}
      <div
        style={{
          backgroundColor: T.surface,
          borderRadius: 10,
          padding: 16,
          marginBottom: 20,
          border: `1px solid ${T.border}`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>
              Overline (subtitle)
            </label>
            <input
              data-testid="overline-input"
              type="text"
              value={config.promo_overline || ''}
              onChange={(e) => {
                setConfig({ ...config, promo_overline: e.target.value });
                setUnsavedChanges(true);
              }}
              onBlur={() =>
                handleSaveField({ promo_overline: config.promo_overline || null })
              }
              placeholder="Small text above headline"
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                backgroundColor: T.surface2,
                color: T.text,
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>
              Tagline (hero headline)
            </label>
            <input
              data-testid="tagline-input"
              type="text"
              value={config.promo_tagline || ''}
              onChange={(e) => {
                setConfig({ ...config, promo_tagline: e.target.value });
                setUnsavedChanges(true);
              }}
              onBlur={() =>
                handleSaveField({ promo_tagline: config.promo_tagline || null })
              }
              placeholder="Main headline for your product"
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                backgroundColor: T.surface2,
                color: T.text,
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>
      </div>

      {/* Problem Section */}
      <div
        style={{
          backgroundColor: T.surface,
          borderRadius: 10,
          padding: 16,
          marginBottom: 20,
          border: `1px solid ${T.border}`,
        }}
      >
        <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, display: 'block', marginBottom: 8 }}>
          The Problem (dark section)
        </label>
        <textarea
          data-testid="problem-text-input"
          value={config.promo_problem_text || ''}
          onChange={(e) => {
            setConfig({ ...config, promo_problem_text: e.target.value });
            setUnsavedChanges(true);
          }}
          onBlur={() =>
            handleSaveField({ promo_problem_text: config.promo_problem_text || null })
          }
          placeholder="Describe the problem your product solves"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: `1px solid ${T.border}`,
            backgroundColor: T.surface2,
            color: T.text,
            fontSize: 13,
            fontFamily: 'inherit',
            minHeight: 100,
            resize: 'vertical',
          }}
        />
      </div>

      {/* How It Works Section */}
      <div
        style={{
          backgroundColor: T.surface,
          borderRadius: 10,
          padding: 16,
          marginBottom: 20,
          border: `1px solid ${T.border}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>How It Works</h3>
          <button
            data-testid="add-step-btn"
            onClick={handleAddStep}
            disabled={(config.promo_steps?.length || 0) >= 6}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: `1px solid ${T.accent}`,
              backgroundColor: 'rgba(10, 132, 255, 0.1)',
              color: T.accent,
              cursor: (config.promo_steps?.length || 0) >= 6 ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 600,
              opacity: (config.promo_steps?.length || 0) >= 6 ? 0.5 : 1,
            }}
          >
            + Add Step
          </button>
        </div>

        <div data-testid="steps-section">
          {(config.promo_steps || []).map((step, idx) => (
            <StepEditor
              key={idx}
              step={step}
              index={idx}
              onUpdate={(updated) => handleUpdateStep(idx, updated)}
              onRemove={() => handleRemoveStep(idx)}
            />
          ))}
        </div>
      </div>

      {/* Features Section */}
      <div
        style={{
          backgroundColor: T.surface,
          borderRadius: 10,
          padding: 16,
          marginBottom: 20,
          border: `1px solid ${T.border}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Features</h3>
          <button
            data-testid="add-feature-btn"
            onClick={handleAddFeature}
            disabled={(config.promo_features?.length || 0) >= 6}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: `1px solid ${T.accent}`,
              backgroundColor: 'rgba(10, 132, 255, 0.1)',
              color: T.accent,
              cursor: (config.promo_features?.length || 0) >= 6 ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 600,
              opacity: (config.promo_features?.length || 0) >= 6 ? 0.5 : 1,
            }}
          >
            + Add Feature
          </button>
        </div>

        <div data-testid="features-section">
          {(config.promo_features || []).map((feature, idx) => (
            <FeatureEditor
              key={idx}
              feature={feature}
              index={idx}
              onUpdate={(updated) => handleUpdateFeature(idx, updated)}
              onRemove={() => handleRemoveFeature(idx)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
