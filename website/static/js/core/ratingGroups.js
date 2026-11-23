'use strict';

const M = {
    res:      (s, n, o) => [o.resKey  || `count_res_${s}`,  o.resLabel  || `Количество БС ${n}`],
    procres:  (s, n)    => [`percent_res_${s}`,             `Процент БС ${n}`],
    width:    (s, n)    => [`frequency_width_${s}`,         `Общая ширина полосы ${n}, МГц`],
    channels: (s, n)    => [`count_channels_${s}`,         `Количество каналов ${n}`],
    ab:       (s, n)    => [`count_abonents_${s}`,         `Количество абонентов ${n}`],
    pop:      (s, n, o) => [`population_percent_${s}`,     o.popLabel  || `Процент охвата населения ${n}`],
    cov:      (s, n, o) => [`communication_coverage_${s}`, o.covLabel  || `Покрытие связи ${n}`],
    covp:     (s, n, o) => [`communication_coverage_percent_${s}`, o.covpLabel || `Процент покрытия связи ${n}`],
    traf:     (s, n)    => [`traffic_${s}`,                `Объем трафика ${n}`],
    trafp:    (s, n)    => [`traffic_percent_${s}`,        `Процент трафика ${n}`],
    op:       (s, n)    => [`count_operators_${s}`,        `Количество операторов ${n}`],
    opp:      (s, n)    => [`operators_percent_${s}`,      `Процент операторов ${n}`],
    score:    (s, n)    => [`rating_${s}`,                 `Оценка ${n}`]
};

const SPEC = [
    ['Мобильная связь', 'mobile', 'моб. связи', ['res','ab','pop','cov','covp','traf','trafp','op','opp','score'], {}],
    ['LTE',   'lte',   'LTE',   ['res','ab','pop','cov','covp','traf','trafp','op','score'], {}],
    ['GSM',   'gsm',   'GSM',   ['res','ab','pop','cov','covp','traf','trafp','op','score'], {}],
    ['5G',    '5g',    '5G',    ['res','ab','pop','cov','covp','traf','trafp','op','score'], {}],
    ['Wi-Fi', 'wifi',  'Wi-Fi', ['res','ab','pop','cov','covp','traf','trafp','op','opp','score'], {}],
    ['Tetra', 'tetra', 'Tetra', ['res','ab','pop','cov','covp','traf','trafp','op','score'], {}],
    ['Спутниковая связь (КА)', 'satellites', 'КА', ['res','ab','pop','cov','covp','traf','trafp','op','opp','score'],
        { resKey: 'count_satellites', resLabel: 'Количество КА', covLabel: 'Покрытие КА', covpLabel: 'Процент покрытия КА' }],
    ['Телевидение (ТВ)', 'tv', 'ТВ', ['res','procres','channels','cov','covp','op','opp','score'], {}],
    ['Радиовещание (РВ)', 'rv', 'РВ', ['res','procres','width','channels','cov','covp','op','opp','score'], {}],
    ['Узлы Связи (УС)', 'comm_hubs', 'узлов связи', ['res','ab','pop','cov','covp','traf','trafp','op','opp','score'],
        { resKey: 'count_comm_hubs', resLabel: 'Количество узлов связи', covLabel: 'Покрытие узлов связи', covpLabel: 'Процент покрытия узлов связи' }],
    ['Почтовая связь', 'posts', 'почтовых отделений', ['res','ab','pop','cov','covp','traf','trafp','op','opp','score'],
        { resKey: 'count_posts', resLabel: 'Количество почтовых отделений', covLabel: 'Покрытие почтовых отделений', covpLabel: 'Процент покрытия почтовых отделений' }],
    ['ВОЛС', 'focl', 'ВОЛС', ['res','ab','pop','cov','covp','traf','trafp','op','opp','score'],
        { resKey: 'count_focl', resLabel: 'Количество ВОЛС', covLabel: 'Покрытие ВОЛС', covpLabel: 'Процент покрытия ВОЛС' }],
    ['Таксофоны', 'payphones', 'таксофонов', ['res','ab','pop','cov','covp','traf','trafp','op','opp','score'],
        { resKey: 'count_payphones', resLabel: 'Количество таксофонов', popLabel: 'Процент охвата населения таксофонами', covLabel: 'Покрытие таксофонов', covpLabel: 'Процент покрытия таксофонов' }]
];

let cache = null;

export function buildRatingGroups() {
    if (cache) return cache;
    cache = SPEC.map(([title, suffix, name, metrics, opts]) => ({
        title,
        fields: metrics.map(m => { const [key, label] = M[m](suffix, name, opts); return { key, label }; })
    }));
    return cache;
}