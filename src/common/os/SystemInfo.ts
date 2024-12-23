import axios from 'axios';
import * as systeminformation from 'systeminformation';

class SystemInfo {
  async getExternalIp(): Promise<string> {
    try {
      const response = await axios.get('https://api.ipify.org?format=json');
      return response.data.ip;
    } catch (error) {
      // 捕获特定错误并返回默认值或日志
      console.error('Failed to fetch external IP:', error);
      return '0.0.0.0'; // 返回默认值
    }
  }

  async getIPAddresses(): Promise<string[]> {
    try {
      const networkData = await systeminformation.networkInterfaces();
      console.error('获取 IP 地址networkData:', networkData);
      // 确保 networkData 是数组
      const interfaces = Array.isArray(networkData)
        ? networkData
        : [networkData];

      const ipAddresses = interfaces
        .flatMap((iface) => iface.ip4 || []) // 获取 IPv4 地址
        .filter((ip) => ip && !this.isPrivateIP(ip)); // 过滤掉无效的地址
      return ipAddresses;
    } catch (error) {
      console.error('获取 IP 地址时出错:', error);
    }
  }

  async getMemoryInfo() {
    try {
      const memoryData = await systeminformation.mem();
      return memoryData;
    } catch (error) {
      console.error('获取 内存信息时出错:', error);
    }
  }

  async getCpuInfo() {
    try {
      const cpuData = await systeminformation.cpu();
      return cpuData;
    } catch (error) {
      console.error('获取 CPU 信息时出错:', error);
    }
  }

  async getDiskInfo() {
    try {
      const diskData = await systeminformation.fsSize();
      return diskData;
    } catch (error) {
      console.error('获取 磁盘信息时出错:', error);
    }
  }

  async getUptime() {
    try {
      const uptimeData = await systeminformation.time();
      return uptimeData;
    } catch (error) {
      console.error('获取 运行时间时出错:', error);
    }
  }

  async getSystemInfo() {
    try {
      const systemData = await systeminformation.system();
      return systemData;
    } catch (error) {
      console.error('获取 系统信息时出错:', error);
    }
  }
  // 检查 IP 地址是否为私有地址
  private isPrivateIP(ip: string): boolean {
    return (
      ip.startsWith('10.') || // 10.0.0.0 - 10.255.255.255
      ip.startsWith('192.168.') || // 192.168.0.0 - 192.168.255.255
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) || // 172.16.0.0 - 172.31.255.255
      ip === '127.0.0.1' // 本地回环地址
    );
  }
}

// 使用示例
const systemInfo = new SystemInfo();
export default systemInfo;
// SystemInfo
//   .getIPAddresses()
//   .then((ipAddresses) => {
//     console.log('IP 地址:', ipAddresses);
//   })
//   .catch((error) => {
//     console.error(error.message);
//   });
