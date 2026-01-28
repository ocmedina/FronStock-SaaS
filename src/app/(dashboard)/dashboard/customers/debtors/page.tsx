import { CustomersView } from "@/components/customers/CustomersView";

export default function DebtorsPage() {
    return <CustomersView initialShowDebtorsOnly={true} hideDebtorsToggle={true} />;
}
