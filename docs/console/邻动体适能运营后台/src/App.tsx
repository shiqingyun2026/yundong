/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { CourseList } from './pages/CourseList';
import { CourseEdit } from './pages/CourseEdit';
import { OrderList } from './pages/OrderList';
import { AccountList } from './pages/AccountList';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/courses" element={
          <Layout>
            <CourseList />
          </Layout>
        } />
        
        <Route path="/courses/new" element={
          <Layout>
            <CourseEdit />
          </Layout>
        } />
        
        <Route path="/courses/edit/:id" element={
          <Layout>
            <CourseEdit />
          </Layout>
        } />
        
        <Route path="/orders" element={
          <Layout>
            <OrderList />
          </Layout>
        } />
        
        <Route path="/accounts" element={
          <Layout>
            <AccountList />
          </Layout>
        } />

        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}
