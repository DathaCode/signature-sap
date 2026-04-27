// Sheer Curtain hardware constants and dropdown options

export const CURTAIN_TYPES = ['S Fold'] as const;
export const HEM_OPTIONS = [70] as const;
export const INSTALLATION_TYPES = ['Wall', 'Ceiling'] as const;
export const SHEER_BRACKET_TYPES = ['Standard', 'Extended'] as const;
// When installation is Ceiling, "Ceiling" is the only available bracket type
export const SHEER_BRACKET_TYPES_CEILING = ['Ceiling'] as const;
export const OPENING_TYPES = ['Single Open', 'Centre Open', 'Free Fold'] as const;
export const WAND_SIZES = [1250] as const;
export const FULLNESS_OPTIONS = [120, 130, 140, 150] as const;

// Track Type section
export const TRACK_TYPES = ['Standard', 'Motorised'] as const;
export const MOTOR_TYPES = ['Alpha AC', 'Alpha DC', 'Versa AC', 'Versa DC'] as const;
export const TRACK_CONTROL_SIDES = ['Right', 'Left'] as const;
export const REMOTE_OPTIONS = ['Not Required', 'Single Channel', '5 Channel', '15 Channel'] as const;
export const CHARGER_HUB_OPTIONS = ['Not Required', 'Alpha Charger', 'PULSE 2 Hub', 'Alpha Neo'] as const;
export const TRACK_COLORS = ['Black', 'White'] as const;

// Bend section
export const BEND_TYPES = ['Angle', 'Radius'] as const;

// Pelmet section
export const PELMET_TYPES = [
    'CF90 Cassette',
    'CF90 Cassette with Dim-Out',
    'FRS 100 - Face Fit',
    'FRS 100 - Recess Fit',
    '120mm Matching Upholstered Pelmet Face',
    '150mm Matching Upholstered Pelmet Face',
    '190mm Matching Upholstered Pelmet Face',
] as const;
export const PELMET_COLORS = ['White', 'Black'] as const;
export const PELMET_SIZES = ['Outside Box', 'Custom Size'] as const;
