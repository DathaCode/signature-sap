import { getMaterials, getFabricTypes, getFabricColors, getFabricGroup, isValidColor } from '../fabrics';

describe('Fabric Data', () => {
    describe('getMaterials', () => {
        it('should return all 5 material brands', () => {
            const materials = getMaterials();
            expect(materials).toContain('Alpha');
            expect(materials).toContain('Gracetech');
            expect(materials).toContain('Textstyle');
            expect(materials).toContain('Uniline');
            expect(materials).toContain('Vertex');
            expect(materials.length).toBe(5);
        });
    });

    describe('getFabricTypes', () => {
        it('should return fabric types for a valid material', () => {
            const types = getFabricTypes('Alpha');
            expect(types.length).toBeGreaterThan(0);
            expect(types).toContain('Avoca Block Out');
        });

        it('should return empty array for unknown material', () => {
            expect(getFabricTypes('Unknown')).toEqual([]);
        });
    });

    describe('getFabricColors', () => {
        it('should return colors for a valid material + fabric type', () => {
            const colors = getFabricColors('Alpha', 'Avoca Block Out');
            expect(colors.length).toBeGreaterThan(0);
            expect(colors).toContain('White');
        });

        it('should return empty array for unknown combo', () => {
            expect(getFabricColors('Alpha', 'NonExistent')).toEqual([]);
            expect(getFabricColors('Unknown', 'Avoca Block Out')).toEqual([]);
        });
    });

    describe('getFabricGroup', () => {
        it('should return correct group number for known combos', () => {
            expect(getFabricGroup('Alpha', 'Avoca Block Out')).toBe(2); // G2
        });

        it('should return null for unknown material', () => {
            expect(getFabricGroup('Unknown', 'Avoca Block Out')).toBeNull();
        });

        it('should return null for unknown fabric type', () => {
            expect(getFabricGroup('Alpha', 'NonExistent')).toBeNull();
        });
    });

    describe('isValidColor', () => {
        it('should return true for valid color', () => {
            expect(isValidColor('Alpha', 'Avoca Block Out', 'White')).toBe(true);
        });

        it('should return false for invalid color', () => {
            expect(isValidColor('Alpha', 'Avoca Block Out', 'Neon Pink')).toBe(false);
        });
    });
});
