import { useStore } from '@/hooks/useStore';

export const useAccountInfo = () => {
    const { client } = useStore();
    return {
        loginid: client?.loginid || '',
        currency: client?.currency || 'USD',
        account_type: client?.is_virtual ? 'demo' : 'real',
        balance: client?.balance || '0',
    };
};

export default useAccountInfo;
