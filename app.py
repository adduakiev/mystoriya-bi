import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go

# -----------------------------------------------------------------------------
# 1. КОНФІГУРАЦІЯ ТА СТИЛІЗАЦІЯ ІНТЕРФЕЙСУ
# -----------------------------------------------------------------------------
st.set_page_config(
    page_title="М'ясторія BI — Analytics System",
    page_icon="🥩",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Кастомний CSS для темної преміум-теми
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
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
    }
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

st.title("🥩 М'ясторія — BI Аналітика Доставки та Каналів Продажів")

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
def load_data():
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
                
        # Очищення від некоректних рядків
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
        st.error(f"Помилка зчитування даних: {e}")
        return pd.DataFrame()

raw_df = load_data()

if raw_df.empty:
    st.warning("Дані не завантажено. Перевірте доступ до Google Таблиці.")
    st.stop()

# -----------------------------------------------------------------------------
# 3. ФІЛЬТРИ ТА УПРАВЛІННЯ (SIDEBAR)
# -----------------------------------------------------------------------------
st.sidebar.header("🎛️ Налаштування & Фільтри")

# Перемикач LFL vs ALL
lfl_mode = st.sidebar.radio(
    "Режим аналізу локацій:",
    ["Всі заклади (ALL)", "LFL (Тільки порівнянні 2023-2024)"],
    help="LFL відсіює закриті або нові точки для чистоти порівняння періодів."
)

all_ownership = sorted([x for x in raw_df['Власність'].unique() if x and x != 'nan'])
selected_ownership = st.sidebar.multiselect("Власність:", all_ownership, default=all_ownership)

all_brands = sorted([x for x in raw_df['Бренд'].unique() if x and x != 'nan'])
selected_brands = st.sidebar.multiselect("Бренд:", all_brands, default=all_brands)

all_channels = sorted([x for x in raw_df['Доставка'].unique() if x and x != 'nan'])
selected_channels = st.sidebar.multiselect("Канали відповідальності:", all_channels, default=all_channels)

all_locs = sorted([x for x in raw_df['Склад_Норм'].unique() if x and x != 'nan'])
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
# 4. ГОЛОВНІ ВКЛАДКИ
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
    st.subheader("📌 Загальні показники за обраним зрізом")
    
    rev = df['Сума зі знижкою, грн.'].sum()
    chk = df['Чеків'].sum()
    margin = df['Націнка, грн.'].sum()
    avg_chk = rev / chk if chk > 0 else 0
    margin_rate = (margin / rev * 100) if rev > 0 else 0
    
    # Розрахунок YoY (2024 vs 2023)
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
        st.subheader("🥧 Частка Каналiв у Виторзі")
        fig_pie = px.pie(
            df, values='Сума зі знижкою, грн.', names='Доставка',
            hole=0.45, color_discrete_sequence=px.colors.qualitative.Dark24
        )
        fig_pie.update_layout(margin=dict(t=20, b=20, l=20, r=20))
        st.plotly_chart(fig_pie, use_container_width=True)

# -----------------------------------------------------------------------------
# TAB 2: КАНАЛИ ТА АГРЕГАТОРИ
# -----------------------------------------------------------------------------
with tab_channels:
    st.subheader("🚚 Ваша зона відповідальності: Доставка & Агрегатори")
    
    chan_summary = df.groupby(['Доставка', 'Тип замовлення']).agg({
        'Сума зі знижкою, грн.': 'sum',
        'Чеків': 'sum',
        'Націнка, грн.': 'sum'
    }).reset_index()
    
    chan_summary['Середній чек'] = np.where(chan_summary['Чеків'] > 0, chan_summary['Сума зі знижкою, грн.'] / chan_summary['Чеків'], 0)
    chan_summary['Маржа %'] = np.where(chan_summary['Сума зі знижкою, грн.'] > 0, (chan_summary['Націнка, грн.'] / chan_summary['Сума зі знижкою, грн.']) * 100, 0)
    chan_summary = chan_summary.sort_values(by='Сума зі знижкою, грн.', ascending=False)
    
    st.dataframe(chan_summary.style.format({
        'Сума зі знижкою, грн.': '{:,.0f} ₴',
        'Чеків': '{:,.0f}',
        'Націнка, грн.': '{:,.0f} ₴',
        'Середній чек': '{:,.1f} ₴',
        'Маржа %': '{:.1f}%'
    }), use_container_width=True)
    
    st.markdown("---")
    
    col1, col2 = st.columns(2)
    with col1:
        st.subheader("📊 Порівняння Середнього Чека за Типами Замовлення")
        fig_bar_chk = px.bar(
            chan_summary, x='Тип замовлення', y='Середній чек',
            color='Доставка', text_auto='.0f',
            title="Середній чек (грн)"
        )
        st.plotly_chart(fig_bar_chk, use_container_width=True)
        
    with col2:
        st.subheader("🎯 Порівняння Маржинальності (%) за Каналами")
        fig_bar_mrg = px.bar(
            chan_summary, x='Тип замовлення', y='Маржа %',
            color='Доставка', text_auto='.1f',
            title="Маржинальність (%)"
        )
        st.plotly_chart(fig_bar_mrg, use_container_width=True)

# -----------------------------------------------------------------------------
# TAB 3: ДИНАМІКА LFL & ТРЕНДИ
# -----------------------------------------------------------------------------
with tab_lfl:
    st.subheader("📈 Потижнева Динаміка (YoY / WoW / All Time)")
    
    weekly = df.groupby(['Рік', 'Номер Тижня'])['Сума зі знижкою, грн.'].sum().reset_index()
    
    fig_lfl = px.line(
        weekly, x='Номер Тижня', y='Сума зі знижкою, грн.',
        color='Рік', markers=True,
        title="Потижневий виторг (2023 vs 2024)",
        labels={'Сума зі знижкою, грн.': 'Виторг, ₴', 'Номер Тижня': 'Тиждень року'}
    )
    st.plotly_chart(fig_lfl, use_container_width=True)
    
    st.markdown("---")
    st.subheader("📅 Помісячна матриця виторгу")
    monthly = df.groupby(['Рік', 'Месяц'])['Сума зі знижкою, грн.'].sum().unstack(level=0).fillna(0)
    st.dataframe(monthly.style.format('{:,.0f} ₴'), use_container_width=True)

# -----------------------------------------------------------------------------
# TAB 4: AI INSIGHTS
# -----------------------------------------------------------------------------
with tab_ai:
    st.subheader("🧠 Автоматичний AI-Аналіз та Підказки")
    
    if not chan_summary.empty:
        top_channel = chan_summary.iloc[0]
        high_margin = chan_summary.sort_values(by='Маржа %', ascending=False).iloc[0]
        
        st.info(f"""
        **💡 Ключові операційні висновки для напрямку Доставки:**
        
        1. **Ключовий драйвер обсягу:** Найбільший виторг генерує **{top_channel['Тип замовлення']}** — **{top_channel['Сума зі знижкою, грн.']:,.0f} ₴** (всього {top_channel['Чеків']:,.0f} чеків).
        2. **Максимальна маржинальність:** Найвищу валову маржу забезпечує напрямок **{high_margin['Тип замовлення']}** — **{high_margin['Маржа %']:.1f}%**.
        3. **LFL Стабільність:** Завдяки режиму порівнянності локацій відсіюються викривлення від закритих та нових точок, що дозволяє об'єктивно оцінювати приріст.
        """)
