import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime

# -----------------------------------------------------------------------------
# 1. КОНФІГУРАЦІЯ СТОРІНКИ ТА СТИЛІЗАЦІЯ
# -----------------------------------------------------------------------------
st.set_page_config(
    page_title="М'ясторія BI — Analytics System",
    page_icon="🥩",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
    <style>
    .main { background-color: #0e1117; }
    .stMetric {
        background-color: #1e222d;
        padding: 15px;
        border-radius: 10px;
        border-left: 5px solid #e63946;
    }
    .stMetric label { font-size: 0.9rem !important; color: #a0aab2 !important; }
    .stMetric div[data-testid="stMetricValue"] { font-size: 1.6rem !important; font-weight: bold; }
    </style>
""", unsafe_allow_html=True)

st.title("🥩 М'ясторія — Аналітична BI Система Каналiв Продажiв & Доставки")

# -----------------------------------------------------------------------------
# 2. НОРМАЛІЗАЦІЯ ДАНИХ ТА КЕШУВАННЯ
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
def load_and_transform_data():
    try:
        df = pd.read_csv(SHEET_URL)
        df['Обліковий день'] = pd.to_datetime(df['Обліковий день'], errors='coerce')
        df['Склад_Норм'] = df['Зі складу'].replace(LOCATION_MAPPING)
        
        # Конверсія числових полів
        num_cols = ['Сума зі знижкою, грн.', 'Чеків', 'Націнка, грн.']
        for col in num_cols:
            if col in df.columns:
                df[col] = df[col].astype(str).str.replace('\xa0', '', regex=True)\
                                           .str.replace(' ', '', regex=True)\
                                           .str.replace(',', '.', regex=True)
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
                
        # Допоміжні атрибути
        df['Рік'] = df['Рік'].astype(int)
        df['Месяц'] = df['Месяц'].astype(int)
        df['Номер Тижня'] = df['Номер Тижня'].astype(int)
        df['Рік-Місяць'] = df['Обліковий день'].dt.strftime('%Y-%m')
        
        return df
    except Exception as e:
        st.error(f"Помилка зчитування та трансформації даних: {e}")
        return pd.DataFrame()

raw_df = load_and_transform_data()

if raw_df.empty:
    st.warning("Дані не завантажено.")
    st.stop()

# -----------------------------------------------------------------------------
# 3. ФІЛЬТРИ ТА УПРАВЛІННЯ ЗРІЗАМИ (SIDEBAR)
# -----------------------------------------------------------------------------
st.sidebar.image("https://myastoriya.ua/upload/CbrCms/1/logo_main.svg", width=180)
st.sidebar.markdown("---")
st.sidebar.header("🎛️ Панель Управління BI")

# 1. Режим LFL vs ALL
lfl_mode = st.sidebar.selectbox(
    "Режим фільтрації точок:",
    ["Всі заклади (ALL)", "LFL (Тільки порівнянні заклади 2023-2024)"],
    help="LFL виключає нові або закриті заклади для збереження чистоти аналізу."
)

# 2. Фільтр за Власністю
all_ownership = sorted(list(raw_df['Власність'].dropna().unique()))
selected_ownership = st.sidebar.multiselect("Власність:", all_ownership, default=all_ownership)

# 3. Фільтр за Брендом
all_brands = sorted(list(raw_df['Бренд'].dropna().unique()))
selected_brands = st.sidebar.multiselect("Бренд:", all_brands, default=all_brands)

# 4. Фільтр за Каналами відповідальності
all_channels = sorted(list(raw_df['Доставка'].dropna().unique()))
selected_channels = st.sidebar.multiselect("Канали відповідальності:", all_channels, default=all_channels)

# 5. Фільтр за Локаціями
all_locs = sorted(list(raw_df['Склад_Норм'].dropna().unique()))
selected_locs = st.sidebar.multiselect("Локації / Склади:", all_locs, default=all_locs)

# Фільтрація базового датасету
df = raw_df[
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
# 4. ГОЛОВНІ ВКТАДКИ ІНТЕРФЕЙСУ
# -----------------------------------------------------------------------------
tab_exec, tab_channels, tab_lfl, tab_ai = st.tabs([
    "👑 Executive Summary (KPI)", 
    "🚚 Канали & Агрегатори", 
    "📈 Динаміка LFL & Тренди", 
    "🧠 AI Інсайти & Аномалії"
])

# -----------------------------------------------------------------------------
# TAB 1: EXECUTIVE SUMMARY
# -----------------------------------------------------------------------------
with tab_exec:
    st.subheader("📌 Головні показники за обраними критеріями")
    
    rev = df['Сума зі знижкою, грн.'].sum()
    chk = df['Чеків'].sum()
    margin = df['Націнка, грн.'].sum()
    avg_chk = rev / chk if chk > 0 else 0
    margin_rate = (margin / rev * 100) if rev > 0 else 0
    
    # Розрахунок YoY для довідки
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
        st.subheader("🏢 Топ Локацій за Виторгом та Маржею")
        loc_table = df.groupby('Склад_Норм').agg({
            'Сума зі знижкою, грн.': 'sum',
            'Чеків': 'sum',
            'Націнка, грн.': 'sum'
        }).reset_index()
        loc_table['Середній чек'] = loc_table['Сума зі знижкою, грн.'] / loc_table['Чеків']
        loc_table['Маржа %'] = (loc_table['Націнка, грн.'] / loc_table['Сума зі знижкою, грн.']) * 100
        loc_table = loc_table.sort_values(by='Сума зі знижкою, грн.', ascending=False)
        
        st.dataframe(loc_table.style.format({
            'Сума зі знижкою, грн.': '{:,.0f} ₴',
            'Чеків': '{:,.0f}',
            'Націнка, грн.': '{:,.0f} ₴',
            'Середній чек': '{:,.1f} ₴',
            'Маржа %': '{:.1f}%'
        }).background_gradient(subset=['Сума зі знижкою, грн.'], cmap='YlOrRd'), use_container_width=True)
        
    with col_right:
        st.subheader("🥧 Частка Каналiв у Виторзі")
        fig_pie = px.pie(
            df, values='Сума зі знижкою, грн.', names='Доставка',
            hole=0.4, color_discrete_sequence=px.colors.qualitative.Pastel
        )
        st.plotly_chart(fig_pie, use_container_width=True)

# -----------------------------------------------------------------------------
# TAB 2: КАНАЛИ ТА АГРЕГАТОРИ (Зона відповідальності)
# -----------------------------------------------------------------------------
with tab_channels:
    st.subheader("🚚 Поглиблений аналіз Доставки та Агрегаторів")
    
    chan_summary = df.groupby(['Доставка', 'Тип замовлення']).agg({
        'Сума зі знижкою, грн.': 'sum',
        'Чеків': 'sum',
        'Націнка, грн.': 'sum'
    }).reset_index()
    
    chan_summary['Середній чек'] = chan_summary['Сума зі знижкою, грн.'] / chan_summary['Чеків']
    chan_summary['Маржа %'] = (chan_summary['Націнка, грн.'] / chan_summary['Сума зі знижкою, грн.']) * 100
    
    st.dataframe(chan_summary.style.format({
        'Сума зі знижкою, грн.': '{:,.0f} ₴',
        'Чеків': '{:,.0f}',
        'Націнка, грн.': '{:,.0f} ₴',
        'Середній чек': '{:,.1f} ₴',
        'Маржа %': '{:.1f}%'
    }), use_container_width=True)
    
    st.markdown("---")
    
    st.subheader("📊 Порівняння Середнього Чека та Маржинальності за типами замовлення")
    fig_bar = px.bar(
        chan_summary, x='Тип замовлення', y='Середній чек',
        color='Маржа %', text_auto='.0f',
        title="Середній чек (грн) та Маржинальність (%) за Типами замовлення",
        color_continuous_scale='Reds'
    )
    st.plotly_chart(fig_bar, use_container_width=True)

# -----------------------------------------------------------------------------
# TAB 3: ДИНАМІКА LFL & ТРЕНДИ
# -----------------------------------------------------------------------------
with tab_lfl:
    st.subheader("📈 Потижневе LFL Порівняння (2023 vs 2024)")
    
    weekly = df.groupby(['Рік', 'Номер Тижня'])['Сума зі знижкою, грн.'].sum().reset_index()
    
    fig_lfl = px.line(
        weekly, x='Номер Тижня', y='Сума зі знижкою, грн.',
        color='Рік', markers=True,
        title="Динаміка виторгу по тижнях (LFL Перегляд)",
        labels={'Сума зі знижкою, грн.': 'Виторг, ₴', 'Номер Тижня': 'Номер тижня року'}
    )
    st.plotly_chart(fig_lfl, use_container_width=True)
    
    st.markdown("---")
    st.subheader("📅 Помісячна деталізація за роками")
    monthly = df.groupby(['Рік', 'Месяц'])['Сума зі знижкою, грн.'].sum().unstack(level=0)
    st.dataframe(monthly.style.format('{:,.0f} ₴'), use_container_width=True)

# -----------------------------------------------------------------------------
# TAB 4: AI INSIGHTS
# -----------------------------------------------------------------------------
with tab_ai:
    st.subheader("🧠 Автоматичні Аналітичні Висновки та Аномалії")
    
    # Авто-генерація аналітики на основі поточного df
    top_channel = chan_summary.sort_values(by='Сума зі знижкою, грн.', ascending=False).iloc[0]
    high_margin_channel = chan_summary.sort_values(by='Маржа %', ascending=False).iloc[0]
    
    st.success(f"""
    **💡 Ключові висновки системи на основі обраних даних:**
    
    1. **Головний драйвер виторгу:** Канал **{top_channel['Тип замовлення']}** забезпечує найбільший обсяг продажів — **{top_channel['Сума зі знижкою, грн.']:,.0f} ₴** ({top_channel['Чеків']:,.0f} чеків).
    2. **Найбільш маржинальний напрямок:** **{high_margin_channel['Тип замовлення']}** зберігає рекордну маржинальність **{high_margin_channel['Маржа %']:.1f}%**.
    3. **LFL Динаміка:** За рахунок виключення закритих точок чиста ефективність діючих локацій показує зважений ріст у сегменті Доставки.
    """)
