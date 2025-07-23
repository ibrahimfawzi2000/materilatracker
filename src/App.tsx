import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";

export default function MaterialTracker() {
  const [requests, setRequests] = useState(() => {
    const saved = localStorage.getItem("materialRequests");
    return saved ? JSON.parse(saved) : [];
  });

  const [newRequest, setNewRequest] = useState({
    warehouse: "",
    notes: "",
    date: "",
    items: [],
    projectTitle: "",
  });

  const [newItem, setNewItem] = useState({
    material: "",
    unit: "",
    requestedQty: "",
  });
  const [error, setError] = useState("");
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [filterProject, setFilterProject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [newSupply, setNewSupply] = useState({});
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    localStorage.setItem("materialRequests", JSON.stringify(requests));
  }, [requests]);

  const generateNewRequestId = () => {
    if (requests.length === 0) return "00001";
    const maxIdNum = requests
      .map((r) => parseInt(r.id))
      .filter((num) => !isNaN(num))
      .reduce((max, curr) => (curr > max ? curr : max), 0);
    return (maxIdNum + 1).toString().padStart(5, "0");
  };

  const addItemToRequest = () => {
    if (!newItem.material || !newItem.unit || !newItem.requestedQty) {
      setError("Please fill all item fields");
      return;
    }
    setNewRequest((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ...newItem,
          requestedQty: parseInt(newItem.requestedQty),
          supplied: [],
        },
      ],
    }));
    setNewItem({ material: "", unit: "", requestedQty: "" });
    setError("");
  };

  const removeItemFromRequest = (index) => {
    setNewRequest((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const submitRequest = () => {
    if (
      !newRequest.date ||
      !newRequest.projectTitle ||
      !newRequest.warehouse ||
      newRequest.items.length === 0
    ) {
      setError("Please fill all required fields and add at least one item.");
      return;
    }

    if (editingRequestId) {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === editingRequestId
            ? { ...newRequest, id: editingRequestId }
            : r
        )
      );
    } else {
      const newId = generateNewRequestId();
      setRequests((prev) => [{ ...newRequest, id: newId }, ...prev]);
    }

    setNewRequest({
      warehouse: "",
      notes: "",
      date: "",
      items: [],
      projectTitle: "",
    });
    setEditingRequestId(null);
    setError("");
  };

  const deleteRequest = (id) => {
    if (window.confirm("Are you sure you want to delete this request?")) {
      setRequests((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const editRequest = (id) => {
    const req = requests.find((r) => r.id === id);
    if (req) {
      setNewRequest({ ...req });
      setEditingRequestId(id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const getTotalSupplied = (item) =>
    item.supplied.reduce((sum, s) => sum + s.qty, 0);

  const getStatusText = (item) => {
    const supplied = getTotalSupplied(item);
    if (supplied === 0) return "Pending";
    if (supplied === item.requestedQty) return "Fully Supplied";
    if (supplied > item.requestedQty) return "Supplied More";
    return "Partially Supplied";
  };

  const getStatusColor = (item) => {
    const supplied = getTotalSupplied(item);
    if (supplied === 0) return "red";
    if (supplied === item.requestedQty) return "green";
    if (supplied > item.requestedQty) return "orange";
    return "blue";
  };

  const filteredItems = requests.flatMap((req) =>
    req.items
      .filter((item) => {
        const status = getStatusText(item);
        const matchProject = filterProject
          ? req.projectTitle === filterProject
          : true;
        const matchStatus = filterStatus ? status === filterStatus : true;
        const searchLower = searchText.toLowerCase();

        const matchesSearch =
          item.material.toLowerCase().includes(searchLower) ||
          req.projectTitle.toLowerCase().includes(searchLower) ||
          req.id.includes(searchText);

        return matchProject && matchStatus && matchesSearch;
      })
      .map((item) => ({
        requestId: req.id,
        requestDate: req.date,
        warehouse: req.warehouse,
        projectTitle: req.projectTitle,
        material: item.material,
        unit: item.unit,
        requestedQty: item.requestedQty,
        supplied: getTotalSupplied(item),
        remaining: item.requestedQty - getTotalSupplied(item),
        statusText: getStatusText(item),
        statusColor: getStatusColor(item),
      }))
  );

  const uniqueProjects = [...new Set(requests.map((r) => r.projectTitle))];
  const uniqueStatuses = [
    "Pending",
    "Partially Supplied",
    "Fully Supplied",
    "Supplied More",
  ];

  const exportToExcel = () => {
    const data = filteredItems.map((item) => ({
      RequestID: item.requestId,
      Date: item.requestDate,
      Project: item.projectTitle,
      Warehouse: item.warehouse,
      Material: item.material,
      Unit: item.unit,
      Requested: item.requestedQty,
      Supplied: item.supplied,
      Remaining: item.remaining,
      Status: item.statusText,
    }));
    const sheet = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "MaterialRequests");
    XLSX.writeFile(wb, "material_requests.xlsx");
  };

  const handleSupplyChange = (key, field, value) => {
    setNewSupply((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const addSupplyToItem = (requestId, itemIndex) => {
    const key = `${requestId}_${itemIndex}`;
    const supply = newSupply[key];
    if (!supply || !supply.date || !supply.qty) {
      alert("Please enter supply date and quantity");
      return;
    }
    setRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          const updatedItems = req.items.map((item, idx) => {
            if (idx === itemIndex) {
              return {
                ...item,
                supplied: [
                  ...item.supplied,
                  { date: supply.date, qty: parseInt(supply.qty) || 0 },
                ],
              };
            }
            return item;
          });
          return { ...req, items: updatedItems };
        }
        return req;
      })
    );
    setNewSupply((prev) => ({ ...prev, [key]: { date: "", qty: "" } }));
  };

  // === تحديث printSummaryTable ===
  const printSummaryTable = () => {
    const printWindow = window.open("", "", "width=900,height=600");
    if (!printWindow) return;

    const htmlContent = `
    <html>
      <head>
        <title>Print Summary Table</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            font-size: 14px;
            margin: 0;
            background: white;
          }
          h2 {
            margin-bottom: 20px;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            border-spacing: 0;
            border: none;
          }
          thead th {
            border-bottom: 2px solid #ccc;
            background-color: #eee;
            font-weight: bold;
            padding: 8px;
            text-align: center;
          }
          tbody td {
            border: none;
            padding: 4px 8px;
            text-align: center;
          }
          tbody td.material-cell {
            text-align: left;
            width: 300px;
          }
          .status-pending {
            color: red;
            font-weight: bold;
          }
          .status-partial {
            color: blue;
            font-weight: bold;
          }
          .status-fully {
            color: green;
            font-weight: bold;
          }
          .status-over {
            color: orange;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <h2>Material Requests Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Date</th>
              <th>Project</th>
              <th>Material</th>
              <th>Unit</th>
              <th>Requested</th>
              <th>Supplied</th>
              <th>Remaining</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems
              .map((item) => {
                let statusClass = "";
                switch (item.statusText) {
                  case "Pending":
                    statusClass = "status-pending";
                    break;
                  case "Partially Supplied":
                    statusClass = "status-partial";
                    break;
                  case "Fully Supplied":
                    statusClass = "status-fully";
                    break;
                  case "Supplied More":
                    statusClass = "status-over";
                    break;
                  default:
                    statusClass = "";
                }
                return `
                  <tr>
                    <td>${item.requestId}</td>
                    <td>${item.requestDate}</td>
                    <td>${item.projectTitle}</td>
                    <td class="material-cell">${item.material}</td>
                    <td>${item.unit}</td>
                    <td>${item.requestedQty}</td>
                    <td>${item.supplied}</td>
                    <td>${item.remaining}</td>
                    <td class="${statusClass}">${item.statusText}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // === تحديث printSingleRequest ===
  const printSingleRequest = (request) => {
    const printWindow = window.open("", "", "width=800,height=600");
    if (!printWindow) return;

    const allSupplyDates = Array.from(
      new Set(request.items.flatMap((item) => item.supplied.map((s) => s.date)))
    ).sort();

    const getSupplyQtyByDate = (item, date) => {
      return item.supplied
        .filter((s) => s.date === date)
        .reduce((sum, s) => sum + s.qty, 0);
    };

    const htmlContent = `
    <html>
      <head>
        <title>Print Request ${request.id}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 14px; padding: 20px; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: center; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h2>Request ID: ${request.id}</h2>
        <p><strong>Date:</strong> ${request.date}</p>
        <p><strong>Project Title:</strong> ${request.projectTitle}</p>
        <p><strong>Warehouse:</strong> ${request.warehouse}</p>
        <p><strong>Notes:</strong> ${request.notes || "N/A"}</p>

        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Unit</th>
              <th>Requested Qty</th>
              <th>Supplied Qty</th>
              <th>Remaining</th>
              <th>Status</th>
              ${allSupplyDates.map((date) => `<th>${date}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${request.items
              .map((item) => {
                const totalSupplied = getTotalSupplied(item);
                const remaining = item.requestedQty - totalSupplied;
                const status =
                  totalSupplied === 0
                    ? "Pending"
                    : totalSupplied === item.requestedQty
                    ? "Fully Supplied"
                    : totalSupplied > item.requestedQty
                    ? "Supplied More"
                    : "Partially Supplied";

                return `
                  <tr>
                    <td>${item.material}</td>
                    <td>${item.unit}</td>
                    <td>${item.requestedQty}</td>
                    <td>${totalSupplied}</td>
                    <td>${remaining}</td>
                    <td>${status}</td>
                    ${allSupplyDates
                      .map(
                        (date) =>
                          `<td>${getSupplyQtyByDate(item, date) || ""}</td>`
                      )
                      .join("")}
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h2>Material Requests</h2>

      <button onClick={exportToExcel} style={{ marginRight: 10 }}>
        Export to Excel
      </button>
      <button onClick={printSummaryTable}>Print All Summary</button>

      <div style={{ margin: "10px 0" }}>
        <label>Filter by Project: </label>
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
        >
          <option value="">All</option>
          {uniqueProjects.map((proj, i) => (
            <option key={i} value={proj}>
              {proj}
            </option>
          ))}
        </select>

        <label style={{ marginLeft: 10 }}>Filter by Status: </label>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All</option>
          {uniqueStatuses.map((status, i) => (
            <option key={i} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* مربع البحث */}
      <div style={{ margin: "10px 0" }}>
        <label>Search: </label>
        <input
          type="text"
          placeholder="Search by material, project, or request ID"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ marginLeft: 10, padding: 5, width: 300 }}
        />
      </div>

      {/* جدول الملخص */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: 20,
          border: "none",
        }}
      >
        <thead>
          <tr>
            <th style={{ ...thStyle, width: "70px", textAlign: "center" }}>
              Request ID
            </th>
            <th style={{ ...thStyle, width: "90px", textAlign: "center" }}>
              Date
            </th>
            <th style={{ ...thStyle, textAlign: "center" }}>Project</th>
            {/* عمود المخزن تمت إزالته */}
            <th style={{ ...thStyle, width: "300px", textAlign: "left" }}>
              Material
            </th>
            <th style={{ ...thStyle, width: "70px", textAlign: "center" }}>
              Unit
            </th>
            <th style={{ ...thStyle, width: "80px", textAlign: "center" }}>
              Requested
            </th>
            <th style={{ ...thStyle, width: "80px", textAlign: "center" }}>
              Supplied
            </th>
            <th style={{ ...thStyle, width: "80px", textAlign: "center" }}>
              Remaining
            </th>
            <th style={{ ...thStyle, width: "120px", textAlign: "center" }}>
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.length === 0 && (
            <tr>
              <td colSpan={9} style={{ textAlign: "center", padding: 10 }}>
                No requests found.
              </td>
            </tr>
          )}
          {filteredItems.map((item, index) => (
            <tr key={`${item.requestId}_${index}`}>
              <td style={{ textAlign: "center", padding: "4px 8px" }}>
                {item.requestId}
              </td>
              <td style={{ textAlign: "center", padding: "4px 8px" }}>
                {item.requestDate}
              </td>
              <td style={{ textAlign: "center", padding: "4px 8px" }}>
                {item.projectTitle}
              </td>
              <td style={{ textAlign: "left", padding: "4px 8px" }}>
                {item.material}
              </td>
              <td style={{ textAlign: "center", padding: "4px 8px" }}>
                {item.unit}
              </td>
              <td style={{ textAlign: "center", padding: "4px 8px" }}>
                {item.requestedQty}
              </td>
              <td style={{ textAlign: "center", padding: "4px 8px" }}>
                {item.supplied}
              </td>
              <td style={{ textAlign: "center", padding: "4px 8px" }}>
                {item.remaining}
              </td>
              <td
                style={{
                  color: item.statusColor,
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              >
                {item.statusText}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr style={{ margin: "20px 0" }} />

      {/* نموذج إضافة / تعديل طلب */}
      <div
        style={{
          border: "1px solid #ccc",
          padding: 15,
          borderRadius: 5,
          maxWidth: 800,
          marginBottom: 40,
        }}
      >
        <h3>{editingRequestId ? "Edit Request" : "Add New Request"}</h3>
        {error && <div style={{ color: "red", marginBottom: 10 }}>{error}</div>}

        <label>
          Date:{" "}
          <input
            type="date"
            value={newRequest.date}
            onChange={(e) =>
              setNewRequest((prev) => ({ ...prev, date: e.target.value }))
            }
          />
        </label>
        <br />
        <label>
          Project Title:{" "}
          <input
            type="text"
            value={newRequest.projectTitle}
            onChange={(e) =>
              setNewRequest((prev) => ({
                ...prev,
                projectTitle: e.target.value,
              }))
            }
            placeholder="Project title"
            style={{ width: 300 }}
          />
        </label>
        <br />
        <label>
          Warehouse:{" "}
          <input
            type="text"
            value={newRequest.warehouse}
            onChange={(e) =>
              setNewRequest((prev) => ({ ...prev, warehouse: e.target.value }))
            }
            placeholder="Warehouse"
            style={{ width: 300 }}
          />
        </label>
        <br />
        <label>
          Notes:{" "}
          <textarea
            value={newRequest.notes}
            onChange={(e) =>
              setNewRequest((prev) => ({ ...prev, notes: e.target.value }))
            }
            rows={3}
            cols={50}
            placeholder="Notes (optional)"
          />
        </label>
        <br />
        <h4>Add Items</h4>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Material"
            value={newItem.material}
            onChange={(e) =>
              setNewItem((prev) => ({ ...prev, material: e.target.value }))
            }
            style={{ width: 200 }}
          />
          <input
            type="text"
            placeholder="Unit"
            value={newItem.unit}
            onChange={(e) =>
              setNewItem((prev) => ({ ...prev, unit: e.target.value }))
            }
            style={{ width: 100 }}
          />
          <input
            type="number"
            placeholder="Requested Qty"
            value={newItem.requestedQty}
            onChange={(e) =>
              setNewItem((prev) => ({ ...prev, requestedQty: e.target.value }))
            }
            style={{ width: 130 }}
          />
          <button onClick={addItemToRequest}>Add Item</button>
        </div>

        {newRequest.items.length > 0 && (
          <table
            style={{
              marginTop: 15,
              borderCollapse: "collapse",
              width: "100%",
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>Material</th>
                <th style={thStyle}>Unit</th>
                <th style={thStyle}>Requested Qty</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {newRequest.items.map((item, index) => (
                <tr key={index}>
                  <td style={tdStyle}>{item.material}</td>
                  <td style={tdStyle}>{item.unit}</td>
                  <td style={tdStyle}>{item.requestedQty}</td>
                  <td style={tdStyle}>
                    <button onClick={() => removeItemFromRequest(index)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <br />
        <button onClick={submitRequest}>
          {editingRequestId ? "Update Request" : "Submit Request"}
        </button>
      </div>

      {/* عرض تفاصيل الطلبات مع إمكانية إضافة الكميات المسلمة */}
      <div>
        <h3>All Requests Details</h3>
        {requests.length === 0 && <p>No requests added yet.</p>}

        {requests.map((req) => (
          <div
            key={req.id}
            style={{
              border: "1px solid #ccc",
              padding: 10,
              marginBottom: 20,
              borderRadius: 5,
              maxWidth: 900,
            }}
          >
            <h4>
              Request ID: {req.id} | Project: {req.projectTitle} | Date:{" "}
              {req.date}
            </h4>
            <button onClick={() => editRequest(req.id)}>Edit Request</button>
            <button
              onClick={() => deleteRequest(req.id)}
              style={{ marginLeft: 10 }}
            >
              Delete Request
            </button>
            <button
              onClick={() => printSingleRequest(req)}
              style={{ marginLeft: 10 }}
            >
              Print This Request
            </button>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: 10,
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>Material</th>
                  <th style={thStyle}>Unit</th>
                  <th style={thStyle}>Requested Qty</th>
                  <th style={thStyle}>Supplied Qty</th>
                  <th style={thStyle}>Remaining</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Add Supply</th>
                </tr>
              </thead>
              <tbody>
                {req.items.map((item, idx) => {
                  const totalSupplied = getTotalSupplied(item);
                  const remaining = item.requestedQty - totalSupplied;
                  const status = getStatusText(item);
                  const key = `${req.id}_${idx}`;
                  return (
                    <tr key={key}>
                      <td style={tdStyle}>{item.material}</td>
                      <td style={tdStyle}>{item.unit}</td>
                      <td style={tdStyle}>{item.requestedQty}</td>
                      <td style={tdStyle}>{totalSupplied}</td>
                      <td style={tdStyle}>{remaining}</td>
                      <td style={{ ...tdStyle, color: getStatusColor(item) }}>
                        {status}
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="date"
                          value={(newSupply[key] && newSupply[key].date) || ""}
                          onChange={(e) =>
                            handleSupplyChange(key, "date", e.target.value)
                          }
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          value={(newSupply[key] && newSupply[key].qty) || ""}
                          onChange={(e) =>
                            handleSupplyChange(key, "qty", e.target.value)
                          }
                          style={{ width: 80, marginLeft: 5 }}
                        />
                        <button
                          onClick={() => addSupplyToItem(req.id, idx)}
                          style={{ marginLeft: 5 }}
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

const thStyle = {
  borderBottom: "1px solid #ccc",
  padding: "6px 10px",
  backgroundColor: "#f5f5f5",
};

const tdStyle = {
  borderBottom: "1px solid #eee",
  padding: "6px 10px",
};
