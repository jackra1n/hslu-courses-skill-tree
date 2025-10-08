import { defineConfig, presetIcons, presetTypography, presetWebFonts, presetWind4 } from 'unocss'

export default defineConfig({
    presets: [
        presetWind4(),
        presetTypography(),
        presetIcons(),
        presetWebFonts()
    ]
})