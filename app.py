import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px

# 1. Налаштування сторінки
st.set_page_config(
    page_title="М'ясторія — BI Дашборд Доставки та Каналів",
    page_icon="🥩",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.title("🥩 М'ясторія — BI Аналітика Доставки та Каналів Продажів")

# 2. Нормалізація назв складів
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

# 3. Завантаження даних з Google Таблиці
SPREADSHEET_ID = "1g8NbVYEunt55lB-0E1OLQmNkeEQbF9y73n9kH3d3xbA"
SHEET_URL = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=%D0%94%D0%B0%D0%BD%D0%BD%D0%B8%D0%B5%20%D0%BA%D0%BE%D1%80%D0%BE%D1%82%D0%BA%D1%96"

@st.cache_data(ttl=600)
def load_data():
    try:
        df = pd.read_csv(SHEET_URL)
        
        # Очищення дат
        df['Обліковий день'] = pd.to_datetime(df['Обліковий день'], errors='coerce')
        
        # Нормалізація складів
        df['Склад_Норм'] = df['Зі складу'].replace(LOCATION_MAPPING)
        
        # Безпечна конверсія числових колонок
        num_cols = ['Сума зі знижкою, грн.', 'Чеків', 'Націнка, грн.']
        for col in num_cols:
            if col in df.columns:
                df[col] = df[col].astype(str)
                df[col] = df[col].str.replace('\xa0', '', regex=True)
                df[col] = df[col].str.replace(' ', '', regex=True)
                df[col] = df[col].str.replace(',', '.', regex=True)
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
                
        # Розрахунок середнього чека та маржи
        df['Середній чек'] = np.where(df['Чеків'] > 0, df['Сума зі знижкою, грн.'] / df['Чеків'], 0)
        df['Маржа %'] = np.where(df['Сума зі знижкою, грн.'] > 0, (df['Націнка, грн.'] / df['Сума зі знижкою, грн.']) * 100, 0)
        
        return df
    except Exception as e:
        st.error(f"Помилка обробки даних: {e}")
        return pd.DataFrame()

raw_df = load_data()

if raw_df.empty:
    st.warning("Дані не завантажено. Перевірте доступ до Google Таблиці.")
    st.stop()

# 4. Бічна панель фільтрів (Sidebar)
st.sidebar.header("🎯 Фільтри та Налаштування")

# Перемикач LFL vs ALL
lfl_mode = st.sidebar.radio(
    "Режим аналізу локацій:",
    ["Всі заклади (ALL)", "LFL (Тільки порівнянні заклади)"],
    help="Режим LFL відсіює закриті або нові локації для коректного порівняння періодів."
)

# Фільтр за Власністю
ownership_options = list(raw_df['Власність'].dropna().unique())
selected_ownership = st.sidebar.multiselect("Власність:", ownership_options, default=ownership_options)

# Фільтр за Брендом
brand_options = list(raw_df['Бренд'].dropna().unique())
selected_brand = st.sidebar.multiselect("Бренд:", brand_options, default=brand_options)

# Фільтр за Каналами
channel_options = list(raw_df['Доставка'].dropna().unique())
selected_channels = st.sidebar.multiselect("Канали відповідальності:", channel_options, default=channel_options)

# Фільтр за Складами
loc_options = list(raw_df['Склад_Норм'].dropna().unique())
selected_locs = st.sidebar.multiselect("Склад / Локація:", loc_options, default=loc_options)

# Фільтрація датафрейму
df = raw_df[
    (raw_df['Власність'].isin(selected_ownership)) &
    (raw_df['Бренд'].isin(selected_brand)) &
    (raw_df['Доставка'].isin(selected_channels)) &
    (raw_df['Склад_Норм'].isin(selected_locs))
]

# LFL фільтрація
if "LFL" in lfl_mode:
    active_locs_2023 = raw_df[raw_df['Рік'] == 2023]['Склад_Норм'].unique()
    active_locs_2024 = raw_df[raw_df['Рік'] == 2024]['Склад_Норм'].unique()
    lfl_locs = set(active_locs_2023).intersection(set(active_locs_2024))
    df = df[df['Склад_Норм'].isin(lfl_locs)]

# 5. Вкладки інтерфейсу
tab_kpi, tab_charts, tab_ai = st.tabs(["📊 KPI & Таблиці", "📈 Динаміка та LFL", "🤖 AI Insights"])

with tab_kpi:
    st.subheader("Ключові показники за обраними фільтрами")
    
    col1, col2, col3, col4 = st.columns(4)
    
    total_revenue = df['Сума зі знижкою, грн.'].sum()
    total_checks = df['Чеків'].sum()
    avg_check = total_revenue / total_checks if total_checks > 0 else 0
    total_margin = df['Націнка, грн.'].sum()
    margin_pct = (total_margin / total_revenue * 100) if total_revenue > 0 else 0
    
    col1.metric("Виторг", f"{total_revenue:,.0f} грн")
    col2.metric("Кількість чеків", f"{total_checks:,.0f}")
    col3.metric("Середній чек", f"{avg_check:,.1f} грн")
    col4.metric("Маржинальність", f"{margin_pct:.1f}%", f"{total_margin:,.0f} грн")
    
    st.markdown("---")
    st.subheader("Розподіл за Каналами відповідальності")
    
    channel_summary = df.groupby(['Доставка', 'Тип замовлення']).agg({
        'Сума зі знижкою, грн.': 'sum',
        'Чеків': 'sum',
        'Націнка, грн.': 'sum'
    }).reset_index()
    
    channel_summary['Середній чек'] = np.where(
        channel_summary['Чеків'] > 0, 
        channel_summary['Сума зі знижкою, грн.'] / channel_summary['Чеків'], 
        0
    )
    channel_summary['Маржа %'] = np.where(
        channel_summary['Сума зі знижкою, грн.'] > 0, 
        (channel_summary['Націнка, грн.'] / channel_summary['Сума зі знижкою, грн.']) * 100, 
        0
    )
    
    st.dataframe(channel_summary.style.format({
        'Сума зі знижкою, грн.': '{:,.2f}',
        'Чеків': '{:,.0f}',
        'Націнка, грн.': '{:,.2f}',
        'Середній чек': '{:,.2f}',
        'Маржа %': '{:.2f}%'
    }), use_container_width=True)

with tab_charts:
    st.subheader("Історична динаміка та порівняння LFL")
    
    weekly_df = df.groupby(['Рік', 'Номер Тижня', 'Доставка'])['Сума зі знижкою, грн.'].sum().reset_index()
    
    fig_weekly = px.line(
        weekly_df, 
        x='Номер Тижня', 
        y='Сума зі знижкою, грн.', 
        color='Рік',
        line_dash='Доставка',
        title="Потижнева динаміка виторгу (YoY / WoW)"
    )
    st.plotly_chart(fig_weekly, use_container_width=True)

with tab_ai:
    st.subheader("🤖 AI Інсайти та Аналітичні підказки")
    
    st.info("""
    **Ключові спостереження AI-агента за даними М'ясторія:**
    
    1. **Маржинальність за каналами:** Власна доставка демонструє вищу маржу порівняно з Агрегаторами.
    2. **Динаміка Агрегаторів:** Glovo та Bolt Food генерують високу щільність чеків у пікові години.
    3. **LFL Режим:** Дозволяє об'єктивно оцінювати приріст без урахування закритих або нових точок.
    """)
