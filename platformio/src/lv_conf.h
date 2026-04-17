/**
 * @file lv_conf.h
 * Configuration file for v9.x
 */

#ifndef LV_CONF_H
#define LV_CONF_H

#ifndef __ASSEMBLER__
#include <stdint.h>
#include <stdlib.h>
#endif

#define LV_USE_LOG 1
#define LV_LOG_LEVEL LV_LOG_LEVEL_INFO

#define LV_COLOR_DEPTH 16

/* Use PSRAM for memory allocation if available */
#define LV_MEM_CUSTOM 1
#if LV_MEM_CUSTOM
    #ifndef __ASSEMBLER__
    #define LV_MEM_CUSTOM_ALLOC ps_malloc
    #define LV_MEM_CUSTOM_FREE  free
    #define LV_MEM_CUSTOM_REALLOC realloc
    #endif
#endif

/* Enable Fonts */
#define LV_FONT_MONTSERRAT_14 1
#define LV_FONT_MONTSERRAT_18 1
#define LV_FONT_MONTSERRAT_24 1
#define LV_FONT_MONTSERRAT_28 1
#define LV_FONT_MONTSERRAT_48 1

/* Enable Widgets */
#define LV_USE_LABEL 1
#define LV_USE_BAR 1
#define LV_USE_LED 1
#define LV_USE_OBJ_ID 1

/* Disable architecture specific ASM (fixes Xtensa build errors) */
#define LV_USE_NATIVE_HELIUM_ASM 0
#define LV_USE_NATIVE_ARM32_ASM  0
#define LV_USE_NATIVE_ARM64_ASM  0
#define LV_USE_NATIVE_NEON_ASM   0

#endif /*LV_CONF_H*/
