import { DerivWSAccountsService } from './derivws-accounts.service';

export class DerivAccountService {
    static async fetchAccounts(token: string) {
        return DerivWSAccountsService.fetchAccountsList(token);
    }

    static async fetchOTPUrl(token: string, accountId: string) {
        return DerivWSAccountsService.fetchOTPWebSocketURL(token, accountId);
    }
}

export default DerivAccountService;
