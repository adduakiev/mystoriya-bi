import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime   

# -----------------------------------------------------------------------------
# 1. СТИЛІЗАЦІЯ ТА КОНФІГУРАЦІЯ
# -----------------------------------------------------------------------------
st.set_page_config(
    page_title="М'ясторія BI — Analytics System",
    page_icon="🥩",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
    <style>
    .main { background-color: #0b0e14; }
    div[data-testid="stMetric"] {
        background-color: #161b26;
        padding: 16px 20px;
        border-radius: 12px;
        border: 1px solid #262c3a;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    div[data-testid="stMetric"] label {
        font-size: 0.85rem !important;
        color: #8b949e !important;
        font-weight: 500;
    }
    div[data-testid="stMetricValue"] {
        font-size: 1.75rem !important;
        font-weight: 700;
        color: #f0f6fc;
    }
    .stTabs [data-baseweb="tab-list"] { gap: 8px; }
    .stTabs [data-baseweb="tab"] {
        background-color: #161b26;
        border-radius: 8px;
        padding: 8px 16px;
        color: #8b949e;
        border: 1px solid #262c3a;
    }
    .stTabs [aria-selected="true"] {
        background-color: #e63946 !important;
        color: #ffffff !important;
        font-weight: bold;
    }
    </style>
""", unsafe_allow_html=True)

st.title("🥩 М'ясторія — BI Аналітика Каналiв Продажiв & Доставки")

# -----------------------------------------------------------------------------
# 2. НОРМАЛІЗАЦІЯ ДАНИХ
# -----------------------------------------------------------------------------
LOCATION_MAPPING = {
    'Ахматова NEW': 'Ахматова',
    'Европарк NEW': 'Європарк',
    'Оболонь NEW': 'Оболонь',
    'Теремки NEW': 'Теремки',
    'Кудряшова new': 'Кудряшова',
    'Парк Авеню NEW': 'Парк Авеню',
    'София new': 'Софія',
    'Софія (NEW)': 'Софія'
}

SPREADSHEET_ID = "1g8NbVYEunt55lB-0E1OLQmNkeEQbF9y73n9kH3d3xbA"
SHEET_URL = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=%D0%94%D0%B0%D0%BD%D0%BD%D0%B8%D0%B5%20%D0%BA%D0%BE%D1%80%D0%BE%D1%82%D0%BA%D1%96"

@st.cache_data(ttl=600)
def load_data():
    try:
        df = pd.read_csv(SHEET_URL)
        df['Обліковий день'] = pd.to_datetime(df['Обліковий день'], errors='coerce')
        df['Склад_Норм'] = df['Зі складу'].replace(LOCATION_MAPPING)
        
        # Числові значення
        num_cols = ['Сума зі знижкою, грн.', 'Чеків', 'Націнка, грн.']
        for col in num_cols:
            if col in df.columns:
                df[col] = df[col].astype(str).str.replace('\xa0', '', regex=True)\
                                           .str.replace(' ', '', regex=True)\
                                           .str.replace(',', '.', regex=True)
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
                
        # Чистка від сміття
        str_cols = ['Власність', 'Бренд', 'Доставка', 'Тип замовлення', 'Склад_Норм']
        for col in str_cols:
            if col in df.columns:
                df[col] = df[col].astype(str)
                df = df[~df[col].str.contains('#REF!|#N/A|None|nan', case=False, na=False)]
                
        df['Рік'] = pd.to_numeric(df['Рік'], errors='coerce').fillna(0).astype(int)
        df['Месяц'] = pd.to_numeric(df['Месяц'], errors='coerce').fillna(0).astype(int)
        df['Номер Тижня'] = pd.to_numeric(df['Номер Тижня'], errors='coerce').fillna(0).astype(int)
        
        return df
    except Exception as e:
        st.error(f"Помилка завантаження: {e}")
        return pd.DataFrame()

raw_df = load_data()

if raw_df.empty:
    st.warning("Дані відсутні.")
    st.stop()

# -----------------------------------------------------------------------------
# 3. ФІЛЬТРИ ТА УПРАВЛІННЯ (SIDEBAR)
# -----------------------------------------------------------------------------
st.sidebar.header("🎛️ Панель Управління BI")

# Режим LFL
lfl_mode = st.sidebar.radio(
    "Режим аналізу локацій:",
    ["Всі заклади (ALL)", "LFL (Тільки порівнянні 2023-2024)"],
    help="LFL відсіює закриті або нові заклади для збереження чистоти аналізу."
)

# Роки
all_years = sorted(list(raw_df['Рік'].unique()), reverse=True)
selected_years = st.sidebar.multiselect("Рік:", all_years, default=all_years)

# Власність
all_ownership = sorted([x for x in raw_df['Власність'].unique() if x and x != 'nan'])
selected_ownership = st.sidebar.multiselect("Власність:", all_ownership, default=all_ownership)

# Бренди
all_brands = sorted([x for x in raw_df['Бренд'].unique() if x and x != 'nan'])
selected_brands = st.sidebar.multiselect("Бренд:", all_brands, default=all_brands)

# Канали відповідальності
all_channels = sorted([x for x in raw_df['Доставка'].unique() if x and x != 'nan'])
selected_channels = st.sidebar.multiselect("Канали відповідальності:", all_channels, default=all_channels)

# Склади
all_locs = sorted([x for x in raw_df['Склад_Норм'].unique() if x and x != 'nan'])
selected_locs = st.sidebar.multiselect("Локації / Склади:", all_locs, default=all_locs)

# Фільтрація
df = raw_df[
    (raw_df['Рік'].isin(selected_years)) &
    (raw_df['Власність'].isin(selected_ownership)) &
    (raw_df['Бренд'].isin(selected_brands)) &
    (raw_df['Доставка'].isin(selected_channels)) &
    (raw_df['Склад_Норм'].isin(selected_locs))
]

if "LFL" in lfl_mode:
    locs_2023 = set(raw_df[raw_df['Рік'] == 2023]['Склад_Норм'].unique())
    locs_2024 = set(raw_df[raw_df['Рік'] == 2024]['Склад_Норм'].unique())
    common_locs = locs_2023.intersection(locs_2024)
    df = df[df['Склад_Норм'].isin(common_locs)]

# -----------------------------------------------------------------------------
# 4. ВКЛАДКИ
# -----------------------------------------------------------------------------
tab_exec, tab_channels, tab_lfl, tab_ai = st.tabs([
    "👑 Executive Summary (KPI)", 
    "🚚 Канали & Агрегатори", 
    "📈 Динаміка LFL (WoW, MoM, YoY)", 
    "🧠 AI Інсайти & Аномалії"
])

# -----------------------------------------------------------------------------
# TAB 1: EXECUTIVE SUMMARY
# -----------------------------------------------------------------------------
with tab_exec:
    st.subheader("📌 Загальні операційні показники")
    
    rev = df['Сума зі знижкою, грн.'].sum()
    chk = df['Чеків'].sum()
    margin = df['Націнка, грн.'].sum()
    avg_chk = rev / chk if chk > 0 else 0
    margin_rate = (margin / rev * 100) if rev > 0 else 0
    
    rev_2024 = df[df['Рік'] == 2024]['Сума зі знижкою, грн.'].sum()
    rev_2023 = df[df['Рік'] == 2023]['Сума зі знижкою, грн.'].sum()
    yoy_growth = ((rev_2024 - rev_2023) / rev_2023 * 100) if rev_2023 > 0 else 0
    
    m1, m2, m3, m4, m5 = st.columns(5)
    m1.metric("Загальний Виторг", f"{rev:,.0f} ₴", f"YoY: {yoy_growth:+.1f}%")
    m2.metric("Кількість Чеків", f"{chk:,.0f}")
    m3.metric("Середній Чек", f"{avg_chk:,.1f} ₴")
    m4.metric("Валова Націнка", f"{margin:,.0f} ₴")
    m5.metric("Маржинальність", f"{margin_rate:.1f}%")
    
    st.markdown("---")
    
    col_left, col_right = st.columns([6, 4])
    
    with col_left:
        st.subheader("🏢 Локації за Виторгом та Маржею")
        loc_table = df.groupby('Склад_Норм').agg({
            'Сума зі знижкою, грн.': 'sum',
            'Чеків': 'sum',
            'Націнка, грн.': 'sum'
        }).reset_index()
        loc_table['Середній чек'] = np.where(loc_table['Чеків'] > 0, loc_table['Сума зі знижкою, грн.'] / loc_table['Чеків'], 0)
        loc_table['Маржа %'] = np.where(loc_table['Сума зі знижкою, грн.'] > 0, (loc_table['Націнка, грн.'] / loc_table['Сума зі знижкою, грн.']) * 100, 0)
        loc_table = loc_table.sort_values(by='Сума зі знижкою, грн.', ascending=False)
        
        st.dataframe(loc_table.style.format({
            'Сума зі знижкою, грн.': '{:,.0f} ₴',
            'Чеків': '{:,.0f}',
            'Націнка, грн.': '{:,.0f} ₴',
            'Середній чек': '{:,.1f} ₴',
            'Маржа %': '{:.1f}%'
        }), use_container_width=True)
        
    with col_right:
        st.subheader("🥧 Частка Каналiв відповідальності")
        fig_pie = px.pie(
            df, values='Сума зі знижкою, грн.', names='Доставка',
            hole=0.45, color_discrete_sequence=px.colors.qualitative.Dark24
        )
        st.plotly_chart(fig_pie, use_container_width=True)

# -----------------------------------------------------------------------------
# TAB 2: КАНАЛИ ТА АГРЕГАТОРИ
# -----------------------------------------------------------------------------
with tab_channels:
    st.subheader("🚚 Детальний аналіз вашої зони: Доставка & Агрегатори")
    
    chan_summary = df.groupby(['Доставка', 'Тип замовлення']).agg({
        'Сума зі знижкою, грн.': 'sum',
        'Чеків': 'sum',
        'Націнка, грн.': 'sum'
    }).reset_index()
    
    total_rev_channels = chan_summary['Сума зі знижкою, грн.'].sum()
    chan_summary['Частка ринку %'] = (chan_summary['Сума зі знижкою, грн.'] / total_rev_channels * 100) if total_rev_channels > 0 else 0
    chan_summary['Середній чек'] = np.where(chan_summary['Чеків'] > 0, chan_summary['Сума зі знижкою, грн.'] / chan_summary['Чеків'], 0)
    chan_summary['Маржа %'] = np.where(chan_summary['Сума зі знижкою, грн.'] > 0, (chan_summary['Націнка, грн.'] / chan_summary['Сума зі знижкою, грн.']) * 100, 0)
    chan_summary = chan_summary.sort_values(by='Сума зі знижкою, грн.', ascending=False)
    
    st.dataframe(chan_summary.style.format({
        'Сума зі знижкою, грн.': '{:,.0f} ₴',
        'Частка ринку %': '{:.1f}%',
        'Чеків': '{:,.0f}',
        'Націнка, грн.': '{:,.0f} ₴',
        'Середній чек': '{:,.1f} ₴',
        'Маржа %': '{:.1f}%'
    }), use_container_width=True)
    
    st.markdown("---")
    
    col1, col2 = st.columns(2)
    with col1:
        st.subheader("📊 Середній Чек (грн) за типом замовлення")
        fig_bar_chk = px.bar(
            chan_summary, x='Тип замовлення', y='Середній чек',
            color='Доставка', text_auto='.0f'
        )
        st.plotly_chart(fig_bar_chk, use_container_width=True)
        
    with col2:
        st.subheader("🎯 Маржинальність (%) за типом замовлення")
        fig_bar_mrg = px.bar(
            chan_summary, x='Тип замовлення', y='Маржа %',
            color='Доставка', text_auto='.1f'
        )
        st.plotly_chart(fig_bar_mrg, use_container_width=True)

# -----------------------------------------------------------------------------
# TAB 3: ДИНАМІКА LFL (WoW, MoM, YoY)
# -----------------------------------------------------------------------------
with tab_lfl:
    st.subheader("📈 LFL Потижнева Аналітика (Week over Week & Year over Year)")
    
    weekly = df.groupby(['Рік', 'Номер Тижня']).agg({
        'Сума зі знижкою, грн.': 'sum',
        'Чеків': 'sum',
        'Націнка, грн.': 'sum'
    }).reset_index()
    
    # Побудова матриці LFL тижнів
    pivot_weekly_rev = weekly.pivot(index='Номер Тижня', columns='Рік', values='Сума зі знижкою, грн.').fillna(0)
    
    if 2023 in pivot_weekly_rev.columns and 2024 in pivot_weekly_rev.columns:
        pivot_weekly_rev['Приріст YoY, ₴'] = pivot_weekly_rev[2024] - pivot_weekly_rev[2023]
        pivot_weekly_rev['Приріст YoY, %'] = np.where(pivot_weekly_rev[2023] > 0, (pivot_weekly_rev['Приріст YoY, ₴'] / pivot_weekly_rev[2023]) * 100, 0)
    
    fig_lfl = px.line(
        weekly, x='Номер Тижня', y='Сума зі знижкою, грн.',
        color='Рік', markers=True,
        title="Порівняльний потижневий виторг (2023 vs 2024)",
        labels={'Сума зі знижкою, грн.': 'Виторг, ₴', 'Номер Тижня': 'Тиждень року'}
    )
    st.plotly_chart(fig_lfl, use_container_width=True)
    
    st.markdown("---")
    st.subheader("📊 Таблиця LFL потижневого порівняння")
    st.dataframe(pivot_weekly_rev.style.format({
        2023: '{:,.0f} ₴',
        2024: '{:,.0f} ₴',
        'Приріст YoY, ₴': '{:+,.0f} ₴',
        'Приріст YoY, %': '{:+.1f}%'
    }), use_container_width=True)

# -----------------------------------------------------------------------------
# TAB 4: AI INSIGHTS
# -----------------------------------------------------------------------------
with tab_ai:
    st.subheader("🧠 Автоматичні операційні підказки AI")
    
    if not chan_summary.empty:
        top_chan = chan_summary.iloc[0]
        high_mrg = chan_summary.sort_values(by='Маржа %', ascending=False).iloc[0]
        
        st.info(f"""
        **💡 Ключові висновки щодо каналів відповідальності:**
        
        1. **Топ Канал за Виторгом:** **{top_chan['Тип замовлення']}** займає **{top_chan['Частка ринку %']:.1f}%** вашого ринку з виторгом **{top_chan['Сума зі знижкою, грн.']:,.0f} ₴**.
        2. **Найбільш маржинальний канал:** **{high_mrg['Тип замовлення']}** приносить маржу **{high_mrg['Маржа %']:.1f}%**.
        3. **LFL Динаміка:** Усі закриті заклади відсіюються перемикачем у лівій панелі, що гарантує точність YoY порівняння.
        """)
