#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <lvgl.h>
#include <WiFiManager.h>
#include <vector>
#include "DisplayConfig.h"

// --- CONFIGURATION ---
const char* ha_url = "http://192.168.2.69:8123/api/openkairo_mining/data?display=1";
const char* ha_token = ""; // Optional: Add your Long-Lived Access Token here!

#define _LOGGER_DISPLAY(...) Serial.printf(__VA_ARGS__)

// --- GLOBALS ---
LGFX tft;
static const uint32_t screenWidth  = 480;
static const uint32_t screenHeight = 480;
static lv_display_t * disp;

// UI Data Structures
struct MiningData {
  float hashrate = 0;
  float power = 0;
  float efficiency = 0;
  float btc_price = 0;
  float soc = 0;
  int fee_low = 0;
  int fee_med = 0;
  int fee_high = 0;
  bool is_mining = false;
  unsigned long last_update = 0;
};
MiningData current_data;

// --- UI MANAGEMENT ---
struct MinerUI {
    lv_obj_t * tab;
    lv_obj_t * label_h;
    lv_obj_t * label_p;
    lv_obj_t * label_t;
    lv_obj_t * label_wd; // Watchdog status
    lv_obj_t * label_status; // [NEW] Logic Status Label
    
    // Sliders and containers for mode-specific settings
    lv_obj_t * dd_mode;
    
    struct SettingRow {
        lv_obj_t * container;
        lv_obj_t * slider;
        lv_obj_t * label_val;
        String key;
    };
    
    lv_obj_t * settings_cont; // Parent for all settings
    
    SettingRow row_soc_on;
    SettingRow row_soc_off;
    SettingRow row_pv_on;
    SettingRow row_pv_off;
    SettingRow row_bat_min;
    SettingRow row_offgrid_start;
    SettingRow row_offgrid_max;
    SettingRow row_p_min;
    SettingRow row_p_max;
    SettingRow row_delay;

    float current_soc_on = 90, current_soc_off = 30;
    float current_pv_on = 1000, current_pv_off = 500;
    float current_off_s = 90, current_off_m = 98;
    float current_p_min = 400, current_p_max = 1400;
    float current_delay = 5;

    String current_mode = "manual";
    String id;
};

// Global UI Objects
lv_obj_t * tv;
lv_obj_t * tab_main;
MinerUI miner_tabs[4]; // Fix stable size (max 4 miners)
int miner_count = 0;

lv_obj_t * label_hashrate;
lv_obj_t * label_power;
lv_obj_t * label_efficiency;
lv_obj_t * label_btc;
lv_obj_t * label_soc;
lv_obj_t * label_fees;
lv_obj_t * led_mining;
lv_obj_t * btn_restart;
lv_obj_t * btn_reboot;

lv_obj_t * arc_hashrate;      // Main arc
lv_obj_t * arc_hashrate_glow; // Glow layer arc

// --- ANIMATION HELPERS ---
static void set_led_opa_cb(void * var, int32_t v) {
    lv_obj_set_style_opa((lv_obj_t *)var, v, 0);
}

static void set_arc_value(void * obj, int32_t v) {
    lv_arc_set_value((lv_obj_t *)obj, v);
    if (obj == arc_hashrate && arc_hashrate_glow) {
        lv_arc_set_value(arc_hashrate_glow, v);
    }
}

// --- LVGL CALLBACKS ---
void my_disp_flush(lv_display_t *disp, const lv_area_t *area, uint8_t *px_map) {
  uint32_t w = (area->x2 - area->x1 + 1);
  uint32_t h = (area->y2 - area->y1 + 1);
  
  // Use blocking pushImage for maximum stability
  tft.pushImage(area->x1, area->y1, w, h, (uint16_t *)px_map);
  _LOGGER_DISPLAY("F"); // Minimal log to avoid serial congestion
  
  lv_display_flush_ready(disp);
}

// --- UI HELPERS ---
static void btn_event_cb(lv_event_t * e);
static void slider_event_cb(lv_event_t * e);

void createMinerTab(const char* name, String id) {
    if(miner_count >= 4) return;
    
    lv_obj_t * tab = lv_tabview_add_tab(tv, name);
    lv_obj_set_style_bg_color(tab, lv_color_hex(0x0a0a0c), 0);
    lv_obj_set_scrollbar_mode(tab, LV_SCROLLBAR_MODE_AUTO);
    
    MinerUI& mt = miner_tabs[miner_count];
    mt.tab = tab; mt.id = id;

    // Header Glass Card for Data
    lv_obj_t * card = lv_obj_create(tab);
    lv_obj_set_size(card, 440, 90);
    lv_obj_align(card, LV_ALIGN_TOP_MID, 0, 0);
    lv_obj_set_style_bg_color(card, lv_color_hex(0x1a1a1f), 0);
    lv_obj_set_style_border_color(card, lv_color_hex(0x333333), 0);
    lv_obj_set_style_radius(card, 12, 0);
    lv_obj_set_style_pad_all(card, 10, 0);

    lv_obj_t * l_name = lv_label_create(card);
    lv_label_set_text(l_name, name);
    lv_obj_set_style_text_font(l_name, &lv_font_montserrat_18, 0);
    lv_obj_set_style_text_color(l_name, lv_color_hex(0x0bc4e2), 0);
    lv_obj_align(l_name, LV_ALIGN_TOP_LEFT, 0, -5);

    mt.label_h = lv_label_create(card);
    lv_label_set_text(mt.label_h, "0.00 TH/s");
    lv_obj_set_style_text_font(mt.label_h, &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_color(mt.label_h, lv_color_hex(0xffffff), 0);
    lv_obj_align(mt.label_h, LV_ALIGN_BOTTOM_LEFT, 0, 0);

    mt.label_p = lv_label_create(card);
    lv_obj_set_style_text_color(mt.label_p, lv_color_hex(0xffffff), 0);
    lv_obj_align(mt.label_p, LV_ALIGN_TOP_RIGHT, 0, 0);
    
    mt.label_t = lv_label_create(card);
    lv_obj_set_style_text_color(mt.label_t, lv_color_hex(0xffffff), 0);
    lv_obj_align(mt.label_t, LV_ALIGN_BOTTOM_RIGHT, 0, 0);

    mt.label_wd = lv_label_create(card);
    lv_label_set_text(mt.label_wd, "");
    lv_obj_set_style_text_font(mt.label_wd, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(mt.label_wd, lv_color_hex(0xd62cf6), 0); // Magenta (Matches Brain State)
    lv_obj_align(mt.label_wd, LV_ALIGN_TOP_MID, 0, 2);

    mt.label_status = lv_label_create(card); // [NEW] Logic Status Label
    lv_label_set_text(mt.label_status, "");
    lv_obj_set_style_text_font(mt.label_status, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(mt.label_status, lv_color_hex(0xd62cf6), 0); // Magenta
    lv_obj_align(mt.label_status, LV_ALIGN_BOTTOM_MID, 0, -2);

    // MODE SELECTION DROPDOWN
    lv_obj_t * dd = lv_dropdown_create(tab);
    lv_obj_set_size(dd, 440, 45);
    lv_obj_align(dd, LV_ALIGN_TOP_MID, 0, 100);
    lv_dropdown_set_options(dd, "Manual\nPV-Power\nBatterie-SOC\nOffgrid-PV");
    lv_obj_set_style_bg_color(dd, lv_color_hex(0x1a1a1f), 0);
    lv_obj_set_style_text_color(dd, lv_color_hex(0xffffff), 0);
    lv_obj_set_style_border_color(dd, lv_color_hex(0x333333), 0);
    lv_obj_add_event_cb(dd, btn_event_cb, LV_EVENT_VALUE_CHANGED, NULL);
    mt.dd_mode = dd;

    // Settings Parent
    mt.settings_cont = lv_obj_create(tab);
    lv_obj_set_size(mt.settings_cont, 440, 400); 
    lv_obj_align(mt.settings_cont, LV_ALIGN_TOP_MID, 0, 155);
    lv_obj_set_style_bg_opa(mt.settings_cont, 0, 0);
    lv_obj_set_style_border_width(mt.settings_cont, 0, 0);
    lv_obj_set_style_pad_all(mt.settings_cont, 0, 0);
    lv_obj_set_flex_flow(mt.settings_cont, LV_FLEX_FLOW_COLUMN);

    auto create_slider_row = [&](const char* title, int min, int max, MinerUI::SettingRow &row) {
        row.container = lv_obj_create(mt.settings_cont);
        lv_obj_set_size(row.container, 430, 65);
        lv_obj_set_style_bg_color(row.container, lv_color_hex(0x15151a), 0);
        lv_obj_set_style_border_color(row.container, lv_color_hex(0x222222), 0);
        lv_obj_set_style_radius(row.container, 8, 0);
        lv_obj_set_style_pad_all(row.container, 10, 0);

        lv_obj_t * lbl = lv_label_create(row.container);
        lv_label_set_text(lbl, title);
        lv_obj_set_style_text_color(lbl, lv_color_hex(0x888888), 0);
        lv_obj_set_style_text_font(lbl, &lv_font_montserrat_12, 0);
        lv_obj_align(lbl, LV_ALIGN_TOP_LEFT, 0, -2);

        row.label_val = lv_label_create(row.container);
        lv_label_set_text(row.label_val, "---");
        lv_obj_set_style_text_color(row.label_val, lv_color_hex(0x0bc4e2), 0);
        lv_obj_set_style_text_font(row.label_val, &lv_font_montserrat_14, 0);
        lv_obj_align(row.label_val, LV_ALIGN_TOP_RIGHT, 0, -2);

        row.slider = lv_slider_create(row.container);
        lv_obj_set_size(row.slider, 400, 12);
        lv_obj_align(row.slider, LV_ALIGN_BOTTOM_MID, 0, -3);
        lv_slider_set_range(row.slider, min, max);
        lv_obj_set_style_bg_color(row.slider, lv_color_hex(0x0bc4e2), LV_PART_INDICATOR);
        lv_obj_set_style_bg_grad_color(row.slider, lv_color_hex(0x2ecc71), LV_PART_INDICATOR);
        lv_obj_set_style_bg_grad_dir(row.slider, LV_GRAD_DIR_HOR, LV_PART_INDICATOR);
        
        lv_obj_set_style_bg_color(row.slider, lv_color_hex(0xffffff), LV_PART_KNOB);
        lv_obj_set_style_shadow_width(row.slider, 15, LV_PART_KNOB);
        lv_obj_set_style_shadow_color(row.slider, lv_color_hex(0x0bc4e2), LV_PART_KNOB);
        lv_obj_set_style_shadow_opa(row.slider, 200, LV_PART_KNOB);
        lv_obj_set_style_radius(row.slider, LV_RADIUS_CIRCLE, LV_PART_KNOB);
        
        lv_obj_add_event_cb(row.slider, slider_event_cb, LV_EVENT_VALUE_CHANGED, (void*)&mt);
        lv_obj_add_event_cb(row.slider, slider_event_cb, LV_EVENT_RELEASED, (void*)&mt);
    };

    create_slider_row("START LEVEL (%)", 0, 100, mt.row_soc_on);
    create_slider_row("STOP LEVEL (%)", 0, 100, mt.row_soc_off);
    create_slider_row("PV ON THRESHOLD (W)", 0, 5000, mt.row_pv_on);
    create_slider_row("PV OFF THRESHOLD (W)", 0, 5000, mt.row_pv_off);
    create_slider_row("MIN BATTERY (%)", 0, 100, mt.row_bat_min);
    create_slider_row("OFFGRID START (%)", 0, 100, mt.row_offgrid_start);
    create_slider_row("OFFGRID MAX (%)", 0, 100, mt.row_offgrid_max);
    create_slider_row("MIN POWER (W)", 0, 4000, mt.row_p_min);
    create_slider_row("MAX POWER (W)", 0, 4000, mt.row_p_max);
    create_slider_row("HYSTERESIS DELAY (M)", 0, 60, mt.row_delay);

    // Initial Hide
    auto hide_all = [&](MinerUI &m) {
        lv_obj_add_flag(m.row_soc_on.container, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(m.row_soc_off.container, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(m.row_pv_on.container, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(m.row_pv_off.container, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(m.row_bat_min.container, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(m.row_offgrid_start.container, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(m.row_offgrid_max.container, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(m.row_p_min.container, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(m.row_p_max.container, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(m.row_delay.container, LV_OBJ_FLAG_HIDDEN);
    };
    hide_all(mt);
    
    // Heartbeat Animation for Mining LED (initially off)
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, led_mining);
    lv_anim_set_values(&a, 100, 255);
    lv_anim_set_duration(&a, 1000);
    lv_anim_set_playback_duration(&a, 1000);
    lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
    lv_anim_set_exec_cb(&a, set_led_opa_cb);
    lv_anim_start(&a);
    
    miner_count++;
}

// --- ACTION HANDLERS ---
void sendAction(const char* action) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.setConnectTimeout(3000);
    http.begin(ha_url);
    http.addHeader("Content-Type", "application/json");
    char json[64];
    snprintf(json, sizeof(json), "{\"action\":\"%s\"}", action);
    http.POST(json);
    http.end();
  }
}

void sendConfigUpdate(String mid, String key, float val) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(ha_url);
    http.addHeader("Content-Type", "application/json");
    char json[128];
    snprintf(json, sizeof(json), "{\"update_miner_config\":\"%s\",\"params\":{\"%s\":%.1f}}", mid.c_str(), key.c_str(), val);
    http.POST(json);
    http.end();
  }
}

static void slider_event_cb(lv_event_t * e) {
    lv_obj_t * slider = (lv_obj_t*)lv_event_get_target(e);
    MinerUI * mt_ptr = (MinerUI*)lv_event_get_user_data(e);
    if(!mt_ptr) return;
    MinerUI &mt = *mt_ptr;
    
    int val = lv_slider_get_value(slider);
    char buf[32];

    auto update_row = [&](MinerUI::SettingRow &row, String key, const char* unit, float &storage) {
        if (slider == row.slider) {
            storage = (float)val;
            snprintf(buf, sizeof(buf), "%d%s", val, unit);
            lv_label_set_text(row.label_val, buf);
            if(lv_event_get_code(e) == LV_EVENT_RELEASED) {
                sendConfigUpdate(mt.id, key, (float)val);
            }
        }
    };

    update_row(mt.row_soc_on, "soc_on", " %", mt.current_soc_on);
    update_row(mt.row_soc_off, "soc_off", " %", mt.current_soc_off);
    update_row(mt.row_pv_on, "pv_on", " W", mt.current_pv_on);
    update_row(mt.row_pv_off, "pv_off", " W", mt.current_pv_off);
    update_row(mt.row_bat_min, "battery_min_soc", " %", mt.current_pv_on); // reusable storage?
    update_row(mt.row_offgrid_start, "offgrid_soc_start", " %", mt.current_off_s);
    update_row(mt.row_offgrid_max, "offgrid_soc_max", " %", mt.current_off_m);
    update_row(mt.row_p_min, "offgrid_min_power", " W", mt.current_p_min);
    update_row(mt.row_p_max, "offgrid_max_power", " W", mt.current_p_max);
    update_row(mt.row_delay, "delay_minutes", " M", mt.current_delay);
}

static void btn_event_cb(lv_event_t * e) {
    lv_obj_t * btn = (lv_obj_t*)lv_event_get_target(e);
    if(btn == btn_restart) sendAction("restart");
    else if(btn == btn_reboot) sendAction("reboot");
    
    for (int i=0; i<miner_count; i++) {
        MinerUI &mt = miner_tabs[i];
        if (lv_event_get_code(e) == LV_EVENT_VALUE_CHANGED && (lv_obj_t*)lv_event_get_target(e) == mt.dd_mode) {
            uint16_t opt = lv_dropdown_get_selected(mt.dd_mode);
            String mode_str = "manual";
            if(opt == 1) mode_str = "pv";
            else if(opt == 2) mode_str = "soc";
            else if(opt == 3) mode_str = "offgrid";
            
            mt.current_mode = mode_str;
            
            auto set_v = [](lv_obj_t* obj, bool v) { if(v) lv_obj_remove_flag(obj, LV_OBJ_FLAG_HIDDEN); else lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN); };
            set_v(mt.row_soc_on.container, mt.current_mode == "soc");
            set_v(mt.row_soc_off.container, mt.current_mode == "soc");
            set_v(mt.row_pv_on.container, mt.current_mode == "pv");
            set_v(mt.row_pv_off.container, mt.current_mode == "pv");
            set_v(mt.row_bat_min.container, mt.current_mode == "pv");
            set_v(mt.row_offgrid_start.container, mt.current_mode == "offgrid");
            set_v(mt.row_offgrid_max.container, mt.current_mode == "offgrid");
            set_v(mt.row_p_min.container, mt.current_mode == "offgrid");
            set_v(mt.row_p_max.container, mt.current_mode == "offgrid");
            set_v(mt.row_delay.container, mt.current_mode != "manual");

            if (WiFi.status() == WL_CONNECTED) {
              HTTPClient http;
              http.begin(ha_url);
              http.addHeader("Content-Type", "application/json");
              char json[128];
              snprintf(json, sizeof(json), "{\"update_miner_config\":\"%s\",\"params\":{\"mode\":\"%s\"}}", mt.id.c_str(), mt.current_mode.c_str());
              http.POST(json);
              http.end();
            }
        }
    }
}

void my_touchpad_read(lv_indev_t *indev, lv_indev_data_t *data) {
  uint16_t touchX, touchY;
  bool touched = tft.getTouch(&touchX, &touchY);
  if (!touched) {
    data->state = LV_INDEV_STATE_RELEASED;
  } else {
    data->state = LV_INDEV_STATE_PRESSED;
    data->point.x = touchX;
    data->point.y = touchY;
  }
}

// --- DATA FETCHING ---
void fetchData() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(ha_url);
    if (strlen(ha_token) > 0) {
      char auth[512];
      snprintf(auth, sizeof(auth), "Bearer %s", ha_token);
      http.addHeader("Authorization", auth);
    }
    int httpCode = http.GET();
    _LOGGER_DISPLAY("HTTP GET: %d\n", httpCode);

    if (httpCode == 200) {
      String payload = http.getString();
      // Use a heap-allocated JsonDocument to prevent stack overflow (ArduinoJson 7)
      JsonDocument* doc_ptr = new JsonDocument(); 
      DeserializationError error = deserializeJson(*doc_ptr, payload);
      
      if (error) {
          _LOGGER_DISPLAY("JSON Error: %s\n", error.c_str());
          delete doc_ptr;
          http.end();
          return;
      }
      
      JsonDocument& doc = *doc_ptr;
      JsonObject states = doc["states"];
      JsonArray config_miners = doc["config"]["miners"];
      float total_h = 0;
      float total_p = 0;
      bool any_active = false;
      int found_count = 0;

      for (JsonPair kv : states) {
        found_count++;
        String m_id = kv.key().c_str();
        float hr = kv.value()["hashrate"].as<float>();
        float pwr = kv.value()["power"].as<float>();
        float tmp = kv.value()["temp"].as<float>();
        bool is_m = kv.value()["is_mining"].as<bool>();
        
        total_h += hr;
        total_p += pwr;
        if (is_m) any_active = true;

        // Resolve Name
        String f_name = m_id;
        for (JsonObject m : config_miners) {
            if (m["id"] == m_id || m["miner_ip"] == m_id) {
                f_name = m["name"].as<String>();
                break;
            }
        }

        // Update Tabs
        bool exists = false;
        for (int i=0; i<miner_count; i++) {
            MinerUI &mt = miner_tabs[i];
            if (mt.id == m_id) {
                exists = true;
                char hBuf[32], pBuf[32], tBuf[32];
                dtostrf(hr, 1, 2, hBuf); strcat(hBuf, " TH/s");
                dtostrf(pwr, 1, 0, pBuf); strcat(pBuf, " W");
                dtostrf(tmp, 1, 1, tBuf); strcat(tBuf, " C");
                lv_label_set_text(mt.label_h, hBuf);
                lv_label_set_text(mt.label_p, pBuf);
                lv_label_set_text(mt.label_t, tBuf);
                
                // Advanced Status Message
                String s_msg = kv.value()["status_msg"].as<String>();
                if (lv_obj_is_valid(mt.label_status)) {
                    if (s_msg != "null" && s_msg != "") {
                        lv_label_set_text(mt.label_status, s_msg.c_str());
                    } else {
                        lv_label_set_text(mt.label_status, "");
                    }
                }
                
                // Watchdog Countdown Sync
                int wd_rem = kv.value()["watchdog_remaining"].as<int>();
                if (wd_rem > 0) {
                    char wdBuf[32];
                    snprintf(wdBuf, sizeof(wdBuf), "WD: %ds", wd_rem);
                    lv_label_set_text(mt.label_wd, wdBuf);
                    lv_obj_remove_flag(mt.label_wd, LV_OBJ_FLAG_HIDDEN);
                } else {
                    lv_obj_add_flag(mt.label_wd, LV_OBJ_FLAG_HIDDEN);
                }

                // Config Sync
                for (JsonObject m : config_miners) {
                    if (m["id"] == m_id || m["miner_ip"] == m_id) {
                        auto sync_row = [&](MinerUI::SettingRow &row, float val, const char* unit) {
                            lv_slider_set_value(row.slider, (int)val, LV_ANIM_OFF);
                            char buf[32]; snprintf(buf, sizeof(buf), "%d%s", (int)val, unit);
                            lv_label_set_text(row.label_val, buf);
                        };
                        mt.current_mode = m["mode"].as<String>();
                        mt.current_soc_on = m["soc_on"].as<float>();
                        mt.current_soc_off = m["soc_off"].as<float>();
                        mt.current_pv_on = m["pv_on"].as<float>();
                        mt.current_pv_off = m["pv_off"].as<float>();
                        mt.current_off_s = m["offgrid_soc_start"].as<float>();
                        mt.current_off_m = m["offgrid_soc_max"].as<float>();
                        mt.current_p_min = m["offgrid_min_power"].as<float>();
                        mt.current_p_max = m["offgrid_max_power"].as<float>();
                        mt.current_delay = m["delay_minutes"].as<float>();

                        sync_row(mt.row_soc_on, mt.current_soc_on, " %");
                        sync_row(mt.row_soc_off, mt.current_soc_off, " %");
                        sync_row(mt.row_pv_on, mt.current_pv_on, " W");
                        sync_row(mt.row_pv_off, mt.current_pv_off, " W");
                        sync_row(mt.row_offgrid_start, mt.current_off_s, " %");
                        sync_row(mt.row_offgrid_max, mt.current_off_m, " %");
                        sync_row(mt.row_p_min, mt.current_p_min, " W");
                        sync_row(mt.row_p_max, mt.current_p_max, " W");
                        sync_row(mt.row_delay, mt.current_delay, " M");

                        auto set_v = [](lv_obj_t* obj, bool v) { if(v) lv_obj_remove_flag(obj, LV_OBJ_FLAG_HIDDEN); else lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN); };
                        set_v(mt.row_soc_on.container, mt.current_mode == "soc");
                        set_v(mt.row_soc_off.container, mt.current_mode == "soc");
                        set_v(mt.row_pv_on.container, mt.current_mode == "pv");
                        set_v(mt.row_pv_off.container, mt.current_mode == "pv");
                        set_v(mt.row_bat_min.container, mt.current_mode == "pv");
                        set_v(mt.row_offgrid_start.container, mt.current_mode == "offgrid");
                        set_v(mt.row_offgrid_max.container, mt.current_mode == "offgrid");
                        set_v(mt.row_p_min.container, mt.current_mode == "offgrid");
                        set_v(mt.row_p_max.container, mt.current_mode == "offgrid");
                        set_v(mt.row_delay.container, mt.current_mode != "manual");

                        int opt = (mt.current_mode == "pv") ? 1 : ((mt.current_mode == "soc") ? 2 : ((mt.current_mode == "offgrid") ? 3 : 0));
                        lv_dropdown_set_selected(mt.dd_mode, opt);
                        break;
                    }
                }
                break;
            }
        }
        if (!exists && miner_count < 4) {
            createMinerTab(f_name.c_str(), m_id);
        }
      }

      _LOGGER_DISPLAY("Fnd: %d, TotHR: %.2f\n", found_count, total_h);
      current_data.hashrate = total_h;
      current_data.power = total_p;
      current_data.is_mining = any_active;
      current_data.last_update = millis();
      if (total_h > 0) current_data.efficiency = total_p / total_h; else current_data.efficiency = 0;

      current_data.btc_price = doc["btc_price"].as<float>();
      current_data.soc = doc["soc"].as<float>();
      current_data.fee_low = doc["mempool"]["fees"]["hourFee"];
      current_data.fee_med = doc["mempool"]["fees"]["halfHourFee"];
      current_data.fee_high = doc["mempool"]["fees"]["fastestFee"];

      // Update Global UI
      char hBuf[16], pBuf[16], eBuf[16], bBuf[32], sBuf[16], fBuf[64];
      if(label_hashrate) {
          dtostrf(current_data.hashrate, 1, 2, hBuf);
          lv_label_set_text(label_hashrate, hBuf);
          int target_val = (int)(current_data.hashrate * 2.0f); // 50 TH/s = 100%
          if (target_val > 100) target_val = 100;

          // Gradient Scaling for Arc
          lv_color_t c_gauge = lv_color_mix(lv_color_hex(0x2ecc71), lv_color_hex(0x0bc4e2), (target_val * 255) / 100);
          lv_obj_set_style_arc_color(arc_hashrate, c_gauge, LV_PART_INDICATOR);
          
          lv_arc_set_value(arc_hashrate, target_val);
          if(arc_hashrate_glow) lv_arc_set_value(arc_hashrate_glow, target_val);
      }
      if(label_power) { dtostrf(current_data.power, 1, 0, pBuf); strcat(pBuf, " W"); lv_label_set_text(label_power, pBuf); }
      if(label_efficiency) { dtostrf(current_data.efficiency, 1, 1, eBuf); strcat(eBuf, " J/TH"); lv_label_set_text(label_efficiency, eBuf); }
      if(label_btc) { dtostrf(current_data.btc_price, 1, 0, bBuf); strcat(bBuf, " EUR"); lv_label_set_text(label_btc, bBuf); }
      if(label_soc) { dtostrf(current_data.soc, 1, 0, sBuf); strcat(sBuf, " %"); lv_label_set_text(label_soc, sBuf); }
      if(led_mining) {
          lv_led_set_color(led_mining, current_data.is_mining ? lv_color_hex(0x00FF00) : lv_color_hex(0xFF0000));
          if(current_data.is_mining) lv_led_on(led_mining); else lv_led_off(led_mining);
      }
      if(label_fees) {
          snprintf(fBuf, sizeof(fBuf), "FEES: %d / %d / %d sat/vB", current_data.fee_low, current_data.fee_med, current_data.fee_high);
          lv_label_set_text(label_fees, fBuf);
      }
      
      delete doc_ptr; // Clean up heap memory!
    }
    http.end();
  }
}

// --- UI INITIALIZATION ---
void setupUI() {
  static lv_style_t style_main;
  lv_style_init(&style_main);
  lv_style_set_bg_color(&style_main, lv_color_hex(0x0a0a0c));

  lv_obj_t * screen = lv_screen_active();
  lv_obj_add_style(screen, &style_main, 0);

  // --- TABVIEW SETUP ---
  tv = lv_tabview_create(screen);
  lv_tabview_set_tab_bar_position(tv, LV_DIR_TOP);
  lv_obj_set_style_bg_color(tv, lv_color_hex(0x0a0a0c), 0);
  
  lv_obj_t * tab_bar = lv_tabview_get_tab_bar(tv);
  lv_obj_set_height(tab_bar, 40); // Slim header
  lv_obj_set_style_bg_color(tab_bar, lv_color_hex(0x1a1a1f), 0);
  lv_obj_set_style_text_font(tab_bar, &lv_font_montserrat_12, 0);
  lv_obj_set_style_pad_all(tab_bar, 0, 0);
  lv_obj_set_style_border_width(tab_bar, 0, 0);

  tab_main = lv_tabview_add_tab(tv, "OVERVIEW");
  lv_obj_set_scrollbar_mode(tab_main, LV_SCROLLBAR_MODE_OFF); // Disable all scrolling on main tab
  lv_obj_set_style_pad_all(tab_main, 0, 0);
  
  // --- DASHBOARD V2 (Main Tab) ---
  // 1. Glow layer arc
  arc_hashrate_glow = lv_arc_create(tab_main);
  lv_obj_set_size(arc_hashrate_glow, 196, 196);
  lv_obj_align(arc_hashrate_glow, LV_ALIGN_TOP_MID, 0, 5); // Shifted down
  lv_arc_set_rotation(arc_hashrate_glow, 135);
  lv_arc_set_bg_angles(arc_hashrate_glow, 0, 270);
  lv_arc_set_value(arc_hashrate_glow, 0);
  lv_obj_remove_style(arc_hashrate_glow, NULL, LV_PART_KNOB);
  lv_obj_set_style_arc_color(arc_hashrate_glow, lv_color_hex(0x0bc4e2), LV_PART_INDICATOR);
  lv_obj_set_style_arc_width(arc_hashrate_glow, 16, LV_PART_INDICATOR);
  lv_obj_set_style_arc_opa(arc_hashrate_glow, 40, LV_PART_INDICATOR);
  lv_obj_set_style_arc_opa(arc_hashrate_glow, 0, LV_PART_MAIN);

  // 2. Main foreground arc
  arc_hashrate = lv_arc_create(tab_main);
  lv_obj_set_size(arc_hashrate, 180, 180);
  lv_obj_align(arc_hashrate, LV_ALIGN_TOP_MID, 0, 15); // Shifted down
  lv_arc_set_rotation(arc_hashrate, 135);
  lv_arc_set_bg_angles(arc_hashrate, 0, 270);
  lv_arc_set_value(arc_hashrate, 0);
  lv_obj_remove_style(arc_hashrate, NULL, LV_PART_KNOB);
  lv_obj_set_style_arc_color(arc_hashrate, lv_color_hex(0x0bc4e2), LV_PART_INDICATOR);
  lv_obj_set_style_arc_width(arc_hashrate, 8, LV_PART_INDICATOR);
  lv_obj_set_style_arc_rounded(arc_hashrate, true, LV_PART_INDICATOR);
  lv_obj_set_style_arc_color(arc_hashrate, lv_color_hex(0x1a1a1f), LV_PART_MAIN);
  lv_obj_set_style_arc_width(arc_hashrate, 8, LV_PART_MAIN);

  label_hashrate = lv_label_create(tab_main);
  lv_label_set_text(label_hashrate, "0.00");
  lv_obj_set_style_text_font(label_hashrate, &lv_font_montserrat_48, 0);
  lv_obj_set_style_text_color(label_hashrate, lv_color_hex(0x0bc4e2), 0);
  lv_obj_align_to(label_hashrate, arc_hashrate, LV_ALIGN_CENTER, 0, -20);
  
  lv_obj_t * l_unit = lv_label_create(tab_main);
  lv_label_set_text(l_unit, "TOTAL HASHRATE (TH/s)");
  lv_obj_set_style_text_color(l_unit, lv_color_hex(0x888888), 0);
  lv_obj_set_style_text_font(l_unit, &lv_font_montserrat_12, 0);
  lv_obj_align_to(l_unit, label_hashrate, LV_ALIGN_OUT_TOP_MID, 0, -5);

  // --- GLASS DATA GRID ---
  auto create_glass_card = [&](lv_obj_t* parent, int x, int y, int w, int h, const char* title, lv_obj_t** target_label, const char* default_val, lv_color_t accent) {
      lv_obj_t * card = lv_obj_create(parent);
      lv_obj_set_size(card, w, h);
      lv_obj_set_pos(card, x, y);
      lv_obj_set_style_bg_color(card, lv_color_hex(0x1a1a1f), 0);
      lv_obj_set_style_bg_opa(card, 220, 0);
      lv_obj_set_style_radius(card, 12, 0);
      lv_obj_set_style_border_width(card, 1, 0);
      lv_obj_set_style_border_side(card, (lv_border_side_t)(LV_BORDER_SIDE_TOP | LV_BORDER_SIDE_LEFT), 0); // Inner glow vibe
      lv_obj_set_style_border_color(card, lv_color_hex(0x555555), 0);
      lv_obj_set_style_pad_all(card, 8, 0);
      lv_obj_set_style_shadow_width(card, 10, 0); // Reduced slightly for layout safety
      lv_obj_set_style_shadow_color(card, lv_color_hex(0x000000), 0);
      lv_obj_set_style_shadow_opa(card, 100, 0);

      lv_obj_t * l_title = lv_label_create(card);
      lv_label_set_text(l_title, title);
      lv_obj_set_style_text_font(l_title, &lv_font_montserrat_12, 0);
      lv_obj_set_style_text_color(l_title, accent, 0); // Accent color for title
      lv_obj_align(l_title, LV_ALIGN_TOP_LEFT, 0, 0);

      *target_label = lv_label_create(card);
      lv_label_set_text(*target_label, default_val);
      lv_obj_set_style_text_font(*target_label, &lv_font_montserrat_18, 0);
      lv_obj_set_style_text_color(*target_label, lv_color_hex(0xffffff), 0);
      lv_obj_align(*target_label, LV_ALIGN_BOTTOM_LEFT, 0, 0);
  };

  // Shifted more down for balance
  create_glass_card(tab_main, 12, 175, 140, 60, "POWER", &label_power, "0 W", lv_color_hex(0x0bc4e2));
  create_glass_card(tab_main, 168, 175, 140, 60, "EFFICIENCY", &label_efficiency, "0 J/TH", lv_color_hex(0x2ecc71));
  create_glass_card(tab_main, 324, 175, 140, 60, "BATTERY", &label_soc, "0 %", lv_color_hex(0xe67e22));

  create_glass_card(tab_main, 12, 245, 451, 50, "BITCOIN PRICE (EUR)", &label_btc, "---", lv_color_hex(0xf1c40f));

  // --- MINING INDICATOR (NEON LED) ---
  led_mining = lv_led_create(tab_main);
  lv_obj_set_size(led_mining, 15, 15);
  lv_obj_align(led_mining, LV_ALIGN_TOP_RIGHT, -20, 10);
  lv_led_set_color(led_mining, lv_color_hex(0xFF0000)); // Default Red
  lv_led_off(led_mining);

  // --- SYSTEM BUTTONS ---
  auto create_btn_sys = [&](lv_obj_t* parent, int x, int y, const char* text, lv_color_t color) {
      lv_obj_t * btn = lv_button_create(parent);
      lv_obj_set_size(btn, 220, 38);
      lv_obj_set_pos(btn, x, y);
      lv_obj_set_style_bg_color(btn, color, 0);
      lv_obj_set_style_bg_grad_color(btn, lv_color_hex(0x111111), 0);
      lv_obj_set_style_bg_grad_dir(btn, LV_GRAD_DIR_VER, 0);
      lv_obj_set_style_radius(btn, 10, 0);
      lv_obj_set_style_border_width(btn, 1, 0);
      lv_obj_set_style_border_color(btn, lv_color_hex(0x444444), 0);
      lv_obj_add_flag(btn, LV_OBJ_FLAG_EVENT_BUBBLE);
      lv_obj_t * lbl = lv_label_create(btn);
      lv_label_set_text(lbl, text);
      lv_obj_center(lbl);
      lv_obj_set_style_text_font(lbl, &lv_font_montserrat_12, 0);
      return btn;
  };

  btn_restart = create_btn_sys(tab_main, 12, 325, "SYSTEM RESTART", lv_color_hex(0x222222));
  lv_obj_add_event_cb(btn_restart, btn_event_cb, LV_EVENT_CLICKED, NULL);

  btn_reboot = create_btn_sys(tab_main, 248, 325, "SYSTEM REBOOT", lv_color_hex(0x222222));
  lv_obj_add_event_cb(btn_reboot, btn_event_cb, LV_EVENT_CLICKED, NULL);

  // Fees Footer
  label_fees = lv_label_create(tab_main);
  lv_label_set_text(label_fees, "FEES: ... sat/vB");
  lv_obj_set_style_text_font(label_fees, &lv_font_montserrat_12, 0);
  lv_obj_set_style_text_color(label_fees, lv_color_hex(0x666666), 0);
  lv_obj_align(label_fees, LV_ALIGN_BOTTOM_MID, 0, -15);
}

// --- MAIN ---
void setup() {
  Serial.begin(115200);
  delay(1000); 
  
  Serial.println("\n[CP 1] SERIAL OK - APP STARTING");
  Serial.flush();
  
  Serial.println("[CP 2] LGFX INIT START...");
  Serial.flush();
  
  // 1. LCD & Touch
  tft.initDevice(); // [NEU] Initialisiere Hardware verzögert
  
  if (!tft.init()) {
    Serial.println("[ERROR] LGFX Init Failed!");
  }
  delay(200);
  tft.setBrightness(255);
  tft.setSwapBytes(true);
  Serial.println("[CP 3] LCD & Backlight OK.");
  Serial.flush();

  // 2. LVGL
  lv_init();
  disp = lv_display_create(screenWidth, screenHeight);
  lv_display_set_flush_cb(disp, my_disp_flush);
  
  // Use internal SRAM (malloc) instead of PSRAM for maximum redraw stability
  size_t buf_size = screenWidth * 100 * sizeof(lv_color_t);
  lv_color_t *buf1 = (lv_color_t *)malloc(buf_size);
  if (buf1 == NULL) {
      Serial.println("SRAM Allocation failed! Trying PSRAM...");
      buf1 = (lv_color_t *)ps_malloc(buf_size);
  }
  
  lv_display_set_buffers(disp, buf1, NULL, buf_size, LV_DISPLAY_RENDER_MODE_PARTIAL);
  Serial.println("[CP 4] LVGL & Display Buffer OK.");
  Serial.flush();

  lv_indev_t * indev = lv_indev_create();
  lv_indev_set_type(indev, LV_INDEV_TYPE_POINTER);
  lv_indev_set_read_cb(indev, my_touchpad_read);

  // 3. WiFi (WiFiManager AP)
  Serial.println("[CP 5] WiFi connecting (Check smartphone for AP: OpenKairo-Mining-Display)...");
  Serial.flush();
  WiFiManager wm;
  //wm.resetSettings(); // Unlock this to clear saved WiFi
  bool res = wm.autoConnect("OpenKairo-Mining-Display", "12345678");

  if(!res) {
    Serial.println("Failed to connect or hit timeout");
    ESP.restart();
  } else {
    Serial.println("CONNECTED");
    Serial.print("IP: "); Serial.println(WiFi.localIP());
  }

  // 4. UI
  setupUI();

  // 5. Initial Data Fetch
  fetchData();
  
  Serial.println("[CP 6] Setup Finished - Entering Loop.");
  Serial.flush();
}

unsigned long lastUpdate = 0;
unsigned long lastHeartbeat = 0;

void loop() {
  lv_tick_inc(5); 
  lv_timer_handler();
  
  if (millis() - lastHeartbeat > 1000) {
    Serial.print(".");
    lastHeartbeat = millis();
  }

  if (millis() - lastUpdate > 15000) {
    fetchData();
    lastUpdate = millis();
  }
  delay(5);
}
