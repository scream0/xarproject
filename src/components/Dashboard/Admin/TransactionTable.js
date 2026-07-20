import styles from "./TransactionTable.module.css";

export default function TransactionTable() {
  const transactions = [
    {
      id: "TRX-001",
      customer: "Aldriyan Divo",
      amount: "Rp 500.000",
      status: "Success",
    },
    {
      id: "TRX-002",
      customer: "Client A",
      amount: "Rp 250.000",
      status: "Pending",
    },
  ];

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ORDER ID</th>
            <th>CUSTOMER</th>
            <th>AMOUNT</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((trx) => (
            <tr key={trx.id} className={styles.row}>
              <td className={styles.orderId}>{trx.id}</td>
              <td>{trx.customer}</td>
              <td>{trx.amount}</td>
              <td>
                <span
                  className={`${styles.statusBadge} ${styles[`status${trx.status}`]}`}
                >
                  {trx.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
