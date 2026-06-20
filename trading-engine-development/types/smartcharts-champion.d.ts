declare module '@deriv-com/smartcharts-champion' {
    export const SmartChart: any;
    export const ChartTitle: any;
    export const setSmartChartsPublicPath: any;
    export type TGranularity = number | string;
    export type TStateChangeListener = (state: string, options?: any) => void;
}
